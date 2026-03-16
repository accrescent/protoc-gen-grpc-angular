// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "vitest";
import { sum } from "./index.js";

test("one plus two equals three", () => {
    expect(sum(1, 2)).toBe(3);
});
