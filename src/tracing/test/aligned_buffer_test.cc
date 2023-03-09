/*
 * Copyright (C) 2017 The Android Open Source Project
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

#include "src/tracing/test/aligned_buffer_test.h"

#include "perfetto/base/logging.h"

namespace perfetto {

#if !PERFETTO_IS_AT_LEAST_CPP17()
// static
constexpr size_t AlignedBufferTest::kNumPages;
#endif

void AlignedBufferTest::SetUp() {
  page_size_ = GetParam();
  buf_.reset(new TestSharedMemory(page_size_ * kNumPages));
}

void AlignedBufferTest::TearDown() {
  buf_.reset();
}

}  // namespace perfetto
