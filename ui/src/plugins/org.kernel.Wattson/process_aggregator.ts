// Copyright (C) 2024 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {exists} from '../../base/utils';
import {ColumnDef, Sorting} from '../../public/aggregation';
import {AreaSelection, AreaSelectionAggregator} from '../../public/selection';
import {CPU_SLICE_TRACK_KIND} from '../../public/track_kinds';
import {Engine} from '../../trace_processor/engine';

export class WattsonProcessSelectionAggregator
  implements AreaSelectionAggregator
{
  readonly id = 'wattson_process_aggregation';

  async createAggregateView(engine: Engine, area: AreaSelection) {
    await engine.query(`drop view if exists ${this.id};`);

    const selectedCpus: number[] = [];
    for (const trackInfo of area.tracks) {
      trackInfo?.tags?.kind === CPU_SLICE_TRACK_KIND &&
        exists(trackInfo.tags.cpu) &&
        selectedCpus.push(trackInfo.tags.cpu);
    }
    if (selectedCpus.length === 0) return false;

    const cpusCsv = `(` + selectedCpus.join() + `)`;
    const duration = area.end - area.start;

    // Prerequisite tables are already generated by Wattson thread aggregation,
    // which is run prior to execution of this module
    engine.query(`
      INCLUDE PERFETTO MODULE wattson.curves.idle_attribution;
      INCLUDE PERFETTO MODULE wattson.curves.estimates;

      -- Only get idle attribution in user defined window and filter by selected
      -- CPUs and GROUP BY process
      CREATE OR REPLACE PERFETTO TABLE _per_process_idle_attribution AS
      SELECT
        ROUND(SUM(idle_cost_mws), 2) as idle_cost_mws,
        upid
      FROM _filter_idle_attribution(${area.start}, ${duration})
      WHERE cpu in ${cpusCsv}
      GROUP BY upid;

      -- Grouped by UPID and made CPU agnostic
      CREATE VIEW ${this.id} AS
      WITH
        base AS (
          SELECT
            ROUND(SUM(total_pws) / ${duration}, 2) as active_mw,
            ROUND(SUM(total_pws) / 1000000000, 2) as active_mws,
            COALESCE(idle_cost_mws, 0) as idle_cost_mws,
            ROUND(
              COALESCE(idle_cost_mws, 0) + SUM(total_pws) / 1000000000,
              2
            ) as total_mws,
            pid,
            process_name
          FROM _unioned_per_cpu_total
          LEFT JOIN _per_process_idle_attribution USING (upid)
          GROUP BY upid
        ),
        secondary AS (
        SELECT pid,
          ROUND(100 * (total_mws) / (SUM(total_mws) OVER()), 2)
            AS percent_of_total_energy
        FROM base
        GROUP BY pid
      )

      select *
        from base INNER JOIN secondary
        USING (pid);
    `);

    return true;
  }

  getColumnDefinitions(): ColumnDef[] {
    return [
      {
        title: 'Process Name',
        kind: 'STRING',
        columnConstructor: Uint16Array,
        columnId: 'process_name',
      },
      {
        title: 'PID',
        kind: 'NUMBER',
        columnConstructor: Uint16Array,
        columnId: 'pid',
      },
      {
        title: 'Active power (estimated mW)',
        kind: 'NUMBER',
        columnConstructor: Float64Array,
        columnId: 'active_mw',
        sum: true,
      },
      {
        title: 'Active energy (estimated mWs)',
        kind: 'NUMBER',
        columnConstructor: Float64Array,
        columnId: 'active_mws',
        sum: true,
      },
      {
        title: 'Idle transitions overhead (estimated mWs)',
        kind: 'NUMBER',
        columnConstructor: Float64Array,
        columnId: 'idle_cost_mws',
        sum: true,
      },
      {
        title: 'Total energy (estimated mWs)',
        kind: 'NUMBER',
        columnConstructor: Float64Array,
        columnId: 'total_mws',
        sum: true,
      },
      {
        title: '% of total energy',
        kind: 'PERCENT',
        columnConstructor: Float64Array,
        columnId: 'percent_of_total_energy',
        sum: false,
      },
    ];
  }

  async getExtra() {}

  getTabName() {
    return 'Wattson by process';
  }

  getDefaultSorting(): Sorting {
    return {column: 'active_mws', direction: 'DESC'};
  }
}
