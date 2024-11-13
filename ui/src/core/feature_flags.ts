// Copyright (C) 2021 The Android Open Source Project
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

// This file should not import anything else. Since the flags will be used from
// ~everywhere and the are "statically" initialized (i.e. files construct Flags
// at import time) if this file starts importing anything we will quickly run
// into issues with initialization order which will be a pain.
import {Flag, FlagSettings, OverrideState} from '../public/feature_flag';

export interface FlagStore {
  load(): object;
  save(o: object): void;
}

// Stored state for a number of flags.
interface FlagOverrides {
  [id: string]: OverrideState;
}

// Check if the given object is a valid FlagOverrides.
// This is necessary since someone could modify the persisted flags
// behind our backs.
function isFlagOverrides(o: object): o is FlagOverrides {
  const states = [
    OverrideState.TRUE.toString(),
    OverrideState.FALSE.toString(),
  ];
  for (const v of Object.values(o)) {
    if (typeof v !== 'string' || !states.includes(v)) {
      return false;
    }
  }
  return true;
}

class Flags {
  private store: FlagStore;
  private flags: Map<string, FlagImpl>;
  private overrides: FlagOverrides;

  constructor(store: FlagStore) {
    this.store = store;
    this.flags = new Map();
    this.overrides = {};
    this.load();
  }

  register(settings: FlagSettings): Flag {
    const id = settings.id;
    if (this.flags.has(id)) {
      throw new Error(`Flag with id "${id}" is already registered.`);
    }

    const saved = this.overrides[id];
    const state = saved === undefined ? OverrideState.DEFAULT : saved;
    const flag = new FlagImpl(this, state, settings);
    this.flags.set(id, flag);
    return flag;
  }

  allFlags(): Flag[] {
    const includeDevFlags = ['127.0.0.1', '::1', 'localhost'].includes(
      window.location.hostname,
    );

    let flags = [...this.flags.values()];
    flags = flags.filter((flag) => includeDevFlags || !flag.devOnly);
    flags.sort((a, b) => a.name.localeCompare(b.name));
    return flags;
  }

  resetAll() {
    for (const flag of this.flags.values()) {
      flag.state = OverrideState.DEFAULT;
    }
    this.save();
  }

  load(): void {
    const o = this.store.load();
    if (isFlagOverrides(o)) {
      this.overrides = o;
    }
  }

  save(): void {
    for (const flag of this.flags.values()) {
      if (flag.isOverridden()) {
        this.overrides[flag.id] = flag.state;
      } else {
        delete this.overrides[flag.id];
      }
    }

    this.store.save(this.overrides);
  }

  /**
   * Modify an override at runtime and save it back to local storage.
   *
   * This method operates on the raw JSON in local storage and doesn't require
   * the presence of a flag to work. Thus, it may be called at any point in the
   * lifecycle of the flags object.
   *
   * @param key - The key of the flag to modify.
   * @param state - The desired state of the flag override.
   */
  patchOverride(key: string, state: OverrideState): void {
    this.overrides[key] = state;
    this.save();
  }
}

class FlagImpl implements Flag {
  registry: Flags;
  state: OverrideState;

  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultValue: boolean;
  readonly devOnly: boolean;

  constructor(registry: Flags, state: OverrideState, settings: FlagSettings) {
    this.registry = registry;
    this.id = settings.id;
    this.state = state;
    this.description = settings.description;
    this.defaultValue = settings.defaultValue;
    this.name = settings.name ?? settings.id;
    this.devOnly = settings.devOnly || false;
  }

  get(): boolean {
    switch (this.state) {
      case OverrideState.TRUE:
        return true;
      case OverrideState.FALSE:
        return false;
      case OverrideState.DEFAULT:
      default:
        return this.defaultValue;
    }
  }

  set(value: boolean): void {
    const next = value ? OverrideState.TRUE : OverrideState.FALSE;
    if (this.state === next) {
      return;
    }
    this.state = next;
    this.registry.save();
  }

  overriddenState(): OverrideState {
    return this.state;
  }

  reset() {
    this.state = OverrideState.DEFAULT;
    this.registry.save();
  }

  isOverridden(): boolean {
    return this.state !== OverrideState.DEFAULT;
  }
}

class LocalStorageStore implements FlagStore {
  static KEY = 'perfettoFeatureFlags';

  load(): object {
    const s = localStorage.getItem(LocalStorageStore.KEY);
    let parsed: object;
    try {
      parsed = JSON.parse(s ?? '{}');
    } catch (e) {
      return {};
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    return parsed;
  }

  save(o: object): void {
    const s = JSON.stringify(o);
    localStorage.setItem(LocalStorageStore.KEY, s);
  }
}

export const FlagsForTesting = Flags;
export const featureFlags = new Flags(new LocalStorageStore());
