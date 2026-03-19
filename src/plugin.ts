// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

import { createEcmaScriptPlugin } from "@bufbuild/protoplugin";

import { generateTs } from "./generateTs.js";

export const plugin = createEcmaScriptPlugin({
    name: "protoc-gen-grpc-angular",
    version: "0.2.0",
    generateTs: generateTs,
});
