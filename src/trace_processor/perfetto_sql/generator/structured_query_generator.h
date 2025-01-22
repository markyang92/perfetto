/*
 * Copyright (C) 2025 The Android Open Source Project
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

#ifndef SRC_TRACE_PROCESSOR_PERFETTO_SQL_GENERATOR_STRUCTURED_QUERY_GENERATOR_H_
#define SRC_TRACE_PROCESSOR_PERFETTO_SQL_GENERATOR_STRUCTURED_QUERY_GENERATOR_H_

#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "perfetto/base/status.h"
#include "perfetto/ext/base/flat_hash_map.h"
#include "perfetto/ext/base/status_or.h"
#include "protos/perfetto/perfetto_sql/structured_query.pbzero.h"

namespace perfetto::trace_processor::perfetto_sql::generator {

using StructuredQuery = protos::pbzero::PerfettoSqlStructuredQuery;

// Allows conversion of a `PerfettoSqlStructuredQuery` proto to a PerfettoSQL
// query with support for shared queries.
class StructuredQueryGenerator {
 public:
  struct SharedQuery {
    std::string id;
    std::string table_name;
    std::string sql;
  };
  struct SharedQueryProto {
    std::unique_ptr<uint8_t[]> data;
    size_t size;
  };

  // Generates an SQL query from the given StructuredQuery proto.
  //
  // This query implicitly assumes that all SQL modules indicated by
  // `referenced_modules` have been included and all shared queries indicated
  // by `referenced_shared_queries` have been created as tables or views.
  base::StatusOr<std::string> Generate(const uint8_t* data, size_t size);

  // Adds a shared query to the internal state to reference in all future
  // calls to `Generate`.
  base::Status AddSharedQuery(const uint8_t* data, size_t size);

  // Computes all the PerfettoSQL modules referenced by any past calls to
  // `Generate`.
  std::vector<std::string> ComputeReferencedModules() const;

  // Returns a summary of all the shared queries which have been referenced
  // by any past calls to `Generate`.
  std::vector<SharedQuery> referenced_shared_queries() const {
    return referenced_shared_queries_;
  }

 private:
  base::FlatHashMap<std::string, SharedQueryProto> shared_queries_protos_;
  std::vector<SharedQuery> referenced_shared_queries_;

  // We don't have FlatHashSet so just (ab)use FlatHashMap by storing a noop
  // value.
  base::FlatHashMap<std::string, std::nullptr_t> referenced_modules_;
};

}  // namespace perfetto::trace_processor::perfetto_sql::generator

#endif  // SRC_TRACE_PROCESSOR_PERFETTO_SQL_GENERATOR_STRUCTURED_QUERY_GENERATOR_H_
