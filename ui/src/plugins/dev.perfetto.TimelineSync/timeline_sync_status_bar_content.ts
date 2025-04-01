// Copyright (C) 2025 The Android Open Source Project
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

import m from 'mithril';
import {Button} from '../../widgets/button';
import {Icon} from '../../widgets/icon';

export interface SyncStatusbarContentAttrs {
  // Callback for Resume button (when status is 'paused')
  readonly onStop?: () => void;
}

export class SyncStatusbarContent
  implements m.ClassComponent<SyncStatusbarContentAttrs>
{
  view(vnode: m.Vnode<SyncStatusbarContentAttrs>): m.Children {
    const {onStop} = vnode.attrs;

    return [
      m('span', [
        m('span', [m(Icon, {icon: 'sync'}), m('span', 'Timeline Sync')]),
        m('span.pf-statusbar__separator'),
        m('span', `Status: Active`),
      ]),
      m(Button, {
        onclick: onStop,
        rightIcon: 'stop_circle',
        label: 'Stop Sync',
        className: 'pf-statusbar__button--red',
      }),
    ];
  }
}
