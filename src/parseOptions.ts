// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

export interface PluginOptions {
    validTypes: boolean;
}

export function parseOptions(rawOptions: { key: string; value: string }[]): PluginOptions {
    const options: PluginOptions = { validTypes: false };

    for (const { key, value } of rawOptions) {
        switch (key) {
            case "valid_types":
                if (value === "true") {
                    options.validTypes = true;
                } else if (value === "false") {
                    options.validTypes = false;
                } else {
                    throw new Error(
                        `invalid value for valid_types: expected "true" or "false", got "${value}"`,
                    );
                }
                break;
            default:
                throw new Error(`unknown option: ${key}`);
        }
    }

    return options;
}
