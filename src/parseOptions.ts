// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

export interface PluginOptions {
    validResponses: boolean;
}

export function parseOptions(rawOptions: { key: string; value: string }[]): PluginOptions {
    const options: PluginOptions = { validResponses: false };

    for (const { key, value } of rawOptions) {
        switch (key) {
            case "valid_responses":
                if (value === "true") {
                    options.validResponses = true;
                } else if (value === "false") {
                    options.validResponses = false;
                } else {
                    throw new Error(
                        `invalid value for valid_responses: expected "true" or "false", got "${value}"`,
                    );
                }
                break;
            default:
                throw new Error(`unknown option: ${key}`);
        }
    }

    return options;
}
