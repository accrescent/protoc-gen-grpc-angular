// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        exclude: [...configDefaults.exclude, "dist/*"],
    },
});
