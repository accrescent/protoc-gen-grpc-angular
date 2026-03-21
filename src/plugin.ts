// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

import { createEcmaScriptPlugin } from "@bufbuild/protoplugin";

import { generateTs } from "./generateTs.js";
import { type PluginOptions, parseOptions } from "./parseOptions.js";

export const plugin = createEcmaScriptPlugin<PluginOptions>({
    name: "protoc-gen-grpc-angular",
    version: "0.3.0",
    generateTs: generateTs,
    parseOptions: parseOptions,
});
