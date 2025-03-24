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

/**
 * This is a multiselect widgets that allows users to select multiple items from
 * a list of options by typing or clicking rather than just clicking I.e. using
 * checkboxes.
 */

import m from 'mithril';
import {HTMLAttrs} from './common';
import {Icon} from './icon';
import {findRef} from '../base/dom_utils';
import {Popup, PopupPosition} from './popup';
import {EmptyState} from './empty_state';
import {classNames} from '../base/classnames';

export interface Option {
  readonly key: string;
  readonly label: string;
}

export interface Multiselect2Attrs extends HTMLAttrs {
  readonly options: ReadonlyArray<Option>;
  readonly selectedOptions: ReadonlyArray<string>;
  readonly onOptionAdd: (key: string) => void;
  readonly onOptionRemove: (key: string) => void;
  readonly placeholder?: string;
}

const INPUT_REF = 'input';

export class Multiselect2 implements m.ClassComponent<Multiselect2Attrs> {
  private currentTextValue = '';
  private popupShowing = false;
  private selectedItemIndex = 0;

  view({attrs}: m.CVnode<Multiselect2Attrs>) {
    const {
      selectedOptions,
      placeholder,
      options,
      onOptionRemove,
      onOptionAdd,
      ...htmlAttrs
    } = attrs;

    return m(
      Popup,
      {
        className: 'pf-multiselect2__popup',
        position: PopupPosition.Bottom,
        // isOpen: this.popupShowing,
        onChange: (shouldOpen) => {
          this.popupShowing = shouldOpen;
        },
        matchWidth: true,
        trigger: m(
          '.pf-multiselect2',
          {
            onclick: (ev: Event) => {
              const target = ev.currentTarget as HTMLElement;
              const inputElement = findRef(target, INPUT_REF);
              if (inputElement) {
                (inputElement as HTMLInputElement).focus();
              }
            },
            ...htmlAttrs,
          },
          // Render the selected options as tags in the text field
          selectedOptions.map((key) => {
            const option = options.find((o) => o.key === key);
            if (option) {
              return renderTag({
                label: option.label,
                onChange: () => {},
                onRemove: () => attrs.onOptionRemove(option.key),
              });
            } else {
              return undefined;
            }
          }),
          m('input', {
            ref: INPUT_REF,
            onfocus: () => (this.popupShowing = true),
            value: this.currentTextValue,
            placeholder,
            oninput: (ev: InputEvent) => {
              // If we're typing we wanna make sure the popup appears
              this.popupShowing = true;
              const el = ev.target as HTMLInputElement;
              this.currentTextValue = el.value;
              this.selectedItemIndex = 0;
            },
            onkeydown: (ev: KeyboardEvent) => {
              const filteredOptions = this.filterOptions(attrs);
              if (ev.key === 'Enter') {
                if (filteredOptions.length > 0) {
                  const option = filteredOptions[this.selectedItemIndex];
                  const alreadyAdded = selectedOptions.includes(option.key);
                  if (alreadyAdded) {
                    onOptionRemove(option.key);
                  } else {
                    onOptionAdd(option.key);
                  }
                  this.currentTextValue = '';
                }
              } else if (ev.key === 'ArrowUp') {
                if (filteredOptions.length > 0) {
                  this.selectedItemIndex = Math.max(
                    0,
                    this.selectedItemIndex - 1,
                  );
                }
                ev.preventDefault();
              } else if (ev.key === 'ArrowDown') {
                if (filteredOptions.length > 0) {
                  this.selectedItemIndex = Math.min(
                    filteredOptions.length - 1,
                    this.selectedItemIndex + 1,
                  );
                }
                ev.preventDefault();
              } else if (ev.key === 'Backspace') {
                if (
                  this.currentTextValue === '' &&
                  selectedOptions.length > 0
                ) {
                  onOptionRemove(selectedOptions[selectedOptions.length - 1]);
                  ev.preventDefault();
                }
              }
            },
          }),
        ),
      },
      this.renderOptions(attrs),
    );
  }

  onupdate({dom}: m.VnodeDOM<Multiselect2Attrs>) {
    if (!this.popupShowing) {
      const inputElement = findRef(dom, INPUT_REF);
      if (inputElement) {
        (inputElement as HTMLInputElement).blur();
      }
    }
  }

  private renderOptions(attrs: Multiselect2Attrs) {
    const {onOptionAdd, onOptionRemove, selectedOptions} = attrs;
    const filtered = this.filterOptions(attrs);

    if (filtered.length === 0) {
      return m(EmptyState);
    }

    return m(
      '.pf-multiselect2__scroller',
      filtered.map((o, index) => {
        const alreadyAdded = selectedOptions.includes(o.key);
        return m(
          '.pf-multiselect2__option-row',
          {
            key: o.key,
            className: classNames(
              this.selectedItemIndex === index &&
                'pf-multiselect2__option-row--selected',
            ),
            onclick: () => {
              if (alreadyAdded) {
                onOptionRemove(o.key);
              } else {
                onOptionAdd(o.key);
              }
            },
          },
          alreadyAdded && m(Icon, {icon: 'check'}),
          o.label,
        );
      }),
    );
  }

  private filterOptions({options}: Multiselect2Attrs) {
    return options.filter((o) => {
      return o.label
        .toLowerCase()
        .includes(this.currentTextValue.toLowerCase());
    });
  }
}

interface TagAttrs {
  readonly label: string;
  readonly onChange?: (value: string) => void;
  readonly onRemove?: () => void;
}

function renderTag({label, onChange, onRemove}: TagAttrs): m.Children {
  return m(
    'span.pf-multiselect2__tag',
    {
      ondblclick: onChange
        ? () => {
            onChange(label);
            onRemove?.();
          }
        : undefined,
    },
    label,
    m(Icon, {
      icon: 'close',
      onclick: () => onRemove?.(),
    }),
  );
}
