#!/usr/bin/env node

// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

import { runNodeJs } from "@bufbuild/protoplugin";

import { plugin } from "./plugin.js";

runNodeJs(plugin);
