/*
 * Copyright (C) 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "src/trace_processor/perfetto_sql/intrinsics/functions/interval_intersect.h"

#include <algorithm>
#include <cinttypes>
#include <cstdint>
#include <memory>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

#include "perfetto/base/logging.h"
#include "perfetto/base/status.h"
#include "perfetto/ext/base/status_or.h"
#include "perfetto/ext/base/string_utils.h"
#include "src/trace_processor/containers/interval_tree.h"
#include "src/trace_processor/containers/string_pool.h"
#include "src/trace_processor/db/runtime_table.h"
#include "src/trace_processor/perfetto_sql/engine/function_util.h"
#include "src/trace_processor/perfetto_sql/engine/perfetto_sql_engine.h"
#include "src/trace_processor/perfetto_sql/intrinsics/types/array.h"
#include "src/trace_processor/perfetto_sql/intrinsics/types/interval_tree.h"
#include "src/trace_processor/perfetto_sql/intrinsics/types/node.h"
#include "src/trace_processor/perfetto_sql/intrinsics/types/row_dataframe.h"
#include "src/trace_processor/perfetto_sql/intrinsics/types/value.h"
#include "src/trace_processor/sqlite/bindings/sqlite_bind.h"
#include "src/trace_processor/sqlite/bindings/sqlite_column.h"
#include "src/trace_processor/sqlite/bindings/sqlite_function.h"
#include "src/trace_processor/sqlite/bindings/sqlite_result.h"
#include "src/trace_processor/sqlite/bindings/sqlite_stmt.h"
#include "src/trace_processor/sqlite/bindings/sqlite_type.h"
#include "src/trace_processor/sqlite/bindings/sqlite_value.h"
#include "src/trace_processor/sqlite/sql_source.h"
#include "src/trace_processor/sqlite/sqlite_engine.h"
#include "src/trace_processor/sqlite/sqlite_utils.h"
#include "src/trace_processor/util/status_macros.h"

namespace perfetto::trace_processor {
namespace {

struct IntervalIntersect : public SqliteFunction<IntervalIntersect> {
  static constexpr char kName[] = "__intrinsic_interval_intersect";
  // First and second tables and an empty set of columns.
  static constexpr int kArgCount = -1;
  static constexpr int kIdxColOffset = 2;

  struct UserDataContext {
    PerfettoSqlEngine* engine;
    StringPool* pool;
  };

  struct MultiIndexInterval {
    uint64_t start;
    uint64_t end;
    std::vector<uint32_t> idx_in_table;

    base::Status AddRow(RuntimeTable::Builder& builder,
                        uint32_t table_count) const {
      RETURN_IF_ERROR(builder.AddInteger(0, static_cast<int64_t>(start)));
      RETURN_IF_ERROR(builder.AddInteger(1, static_cast<int64_t>(end - start)));
      for (uint32_t i = 0; i < table_count; i++) {
        RETURN_IF_ERROR(builder.AddInteger(
            i + kIdxColOffset, static_cast<int64_t>(idx_in_table[i])));
      }
      return base::OkStatus();
    }
  };

  static void Step(sqlite3_context* ctx, int argc, sqlite3_value** argv) {
    PERFETTO_DCHECK(argc >= 3);
    size_t tables_count = static_cast<size_t>(argc - 1);
    std::vector<std::string> col_names;
    col_names.push_back("ts");
    col_names.push_back("dur");
    for (uint32_t i = 0; i < tables_count; i++) {
      base::StackString<32> x("id_%u", i);
      col_names.push_back(x.ToStdString());
    }

    auto* user_data = GetUserData(ctx);

    // Get SortedIntervals from all tables.
    std::vector<perfetto_sql::SortedIntervals*> table_intervals(tables_count);
    std::vector<uint32_t> tables_order(tables_count);
    for (uint32_t i = 0; i < tables_count; i++) {
      table_intervals[i] =
          sqlite::value::Pointer<perfetto_sql::SortedIntervals>(
              argv[i], "INTERVAL_TREE_INTERVALS");
      if (!table_intervals[i] || table_intervals[i]->empty()) {
        SQLITE_ASSIGN_OR_RETURN(
            ctx, auto table,
            RuntimeTable::Builder(user_data->pool, col_names).Build(0));
        return sqlite::result::UniquePointer(ctx, std::move(table), "TABLE");
      }
      tables_order[i] = i;
    }

    // Sort `tables_order[i]` from the smallest to the biggest
    std::sort(tables_order.begin(), tables_order.end(),
              [table_intervals](const uint32_t idx_a, const uint32_t idx_b) {
                return table_intervals[idx_a]->size() <
                       table_intervals[idx_b]->size();
              });

    uint32_t smallest_table_idx = tables_order.front();
    std::vector<MultiIndexInterval> res;

    for (const auto& interval : *table_intervals[smallest_table_idx]) {
      MultiIndexInterval m_int;
      m_int.start = interval.start;
      m_int.end = interval.end;
      m_int.idx_in_table.resize(tables_count);
      m_int.idx_in_table[smallest_table_idx] = interval.id;
      res.push_back(m_int);
    }

    // Create an interval tree on all tables except the smallest - the last one.
    for (uint32_t i = 1; i < tables_count && !res.empty(); i++) {
      uint32_t table_idx = tables_order[i];
      IntervalTree cur_tree(*table_intervals[table_idx]);
      std::vector<MultiIndexInterval> overlaps_with_this_table;
      for (const auto& r : res) {
        std::vector<IntervalTree::Interval> new_intervals;
        cur_tree.FindOverlaps(r.start, r.end, new_intervals);
        for (const auto& overlap : new_intervals) {
          MultiIndexInterval m_int;
          m_int.idx_in_table = std::move(r.idx_in_table);
          m_int.idx_in_table[table_idx] = overlap.id;
          m_int.start = overlap.start;
          m_int.end = overlap.end;
          overlaps_with_this_table.push_back(std::move(m_int));
        }
      }

      res = std::move(overlaps_with_this_table);
    }

    // Push this into the runtime table.
    RuntimeTable::Builder builder(user_data->pool, col_names);

    for (const MultiIndexInterval& interval : res) {
      SQLITE_RETURN_IF_ERROR(
          ctx, interval.AddRow(builder, static_cast<uint32_t>(tables_count)));
    }

    SQLITE_ASSIGN_OR_RETURN(
        ctx, std::unique_ptr<RuntimeTable> ret_tab,
        std::move(builder).Build(static_cast<uint32_t>(res.size())));

    return sqlite::result::UniquePointer(ctx, std::move(ret_tab), "TABLE");
  }
};

}  // namespace

base::Status RegisterIntervalIntersectFunctions(PerfettoSqlEngine& engine,
                                                StringPool* pool) {
  return engine.RegisterSqliteFunction<IntervalIntersect>(
      std::make_unique<IntervalIntersect::UserDataContext>(
          IntervalIntersect::UserDataContext{&engine, pool}));
}

}  // namespace perfetto::trace_processor
