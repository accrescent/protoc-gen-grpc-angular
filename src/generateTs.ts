// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

import { type DescField, type DescMessage, getOption, hasOption } from "@bufbuild/protobuf";
import { safeIdentifier, type Schema } from "@bufbuild/protoplugin";
import { http } from "@buf/googleapis_googleapis.bufbuild_es/google/api/annotations_pb.js";

import {
    HttpBodyOption,
    HttpMethod,
    type ParsedHttpRule,
    PathSegmentKind,
    type PathTemplate,
    parseHttpRule,
} from "./httpRule.js";

export function generateTs(schema: Schema): void {
    for (const file of schema.files) {
        const generatedFile = schema.generateFile(`${file.name}_ng.ts`);
        generatedFile.preamble(file);

        const injectableSym = generatedFile.import("Injectable", "@angular/core");
        const injectSym = generatedFile.import("inject", "@angular/core");
        const httpClientSym = generatedFile.import("HttpClient", "@angular/common/http");
        const observableSym = generatedFile.import("Observable", "rxjs");

        for (const service of file.services) {
            generatedFile.print("@", injectableSym, '({ providedIn: "root" })');
            generatedFile.print(generatedFile.export("class", safeIdentifier(service.name)), " {");
            generatedFile.print(
                "    private readonly httpClient = ",
                injectSym,
                "(",
                httpClientSym,
                ");",
            );

            for (const method of service.methods) {
                const methodName = safeIdentifier(lowercaseFirstChar(method.name));
                const requestType = generatedFile.importShape(method.input);
                const responseType = generatedFile.importShape(method.output);
                if (!hasOption(method, http)) {
                    throw new Error(
                        `${method.parent.typeName}.${method.name}: missing required google.api.http annotation`,
                    );
                }
                const httpRule = getOption(method, http);
                const parsedRule = parseHttpRule(httpRule);

                generatedFile.print();
                generatedFile.print(
                    "    ",
                    methodName,
                    "(request: ",
                    requestType,
                    "): ",
                    observableSym,
                    "<",
                    responseType,
                    ">",
                    " {",
                );

                generatedFile.print(
                    "        const url = ",
                    buildUrlExpression(parsedRule.template, method.input),
                    ";",
                );

                const pathFields = getPathFields(method.input, parsedRule.template);
                const queryParamFields = getQueryParamFields(method.input, pathFields);
                const sendsBody = bodyCarriesUncapturedFields(parsedRule);
                const usesQueryParams = queryParamFields.length > 0 && !sendsBody;

                let bodyExpr: string | undefined;
                if (sendsBody) {
                    if (pathFields.length > 0) {
                        const destructured = pathFields
                            .map((f) => `${f.localName}: _${f.localName}`)
                            .join(", ");
                        generatedFile.print(
                            `        const { ${destructured}, ...body } = request;`,
                        );
                        bodyExpr = "body";
                    } else {
                        bodyExpr = "request";
                    }
                }

                if (usesQueryParams) {
                    generatedFile.print(
                        "        const params: Record<string, string | number | boolean> = {};",
                    );
                    for (const field of queryParamFields) {
                        generatedFile.print(
                            "        if (request.",
                            field.localName,
                            ' !== undefined) params["',
                            field.jsonName,
                            '"] = request.',
                            field.localName,
                            ";",
                        );
                    }
                }

                generatedFile.print();
                generatedFile.print(
                    "        return this.httpClient.",
                    parsedRule.method,
                    "<",
                    responseType,
                    `>(${buildHttpCallArgs(parsedRule, bodyExpr, usesQueryParams).join(", ")});`,
                );

                generatedFile.print("    }");
            }

            generatedFile.print("}");
        }
    }
}

function getPathFields(input: DescMessage, template: PathTemplate): DescField[] {
    const fields: DescField[] = [];
    for (const segment of template.segments) {
        if (segment.kind === PathSegmentKind.Variable) {
            const field = input.fields.find((f) => f.name === segment.ident);
            if (field !== undefined) {
                fields.push(field);
            }
        }
    }
    return fields;
}

function getQueryParamFields(input: DescMessage, pathFields: DescField[]): DescField[] {
    const pathFieldNames = new Set(pathFields.map((f) => f.name));
    return input.fields.filter(
        (f) => !pathFieldNames.has(f.name) && (f.fieldKind === "scalar" || f.fieldKind === "enum"),
    );
}

function bodyCarriesUncapturedFields(rule: ParsedHttpRule): boolean {
    switch (rule.method) {
        case HttpMethod.Get:
        case HttpMethod.Delete:
            return false;
        case HttpMethod.Patch:
        case HttpMethod.Post:
            return rule.bodyOption === HttpBodyOption.AllUncapturedFields;
    }
}

function buildHttpCallArgs(
    rule: ParsedHttpRule,
    bodyExpr: string | undefined,
    hasQueryParams: boolean,
): string[] {
    const args = ["url"];

    switch (rule.method) {
        case HttpMethod.Get:
        case HttpMethod.Delete:
            break;
        case HttpMethod.Patch:
        case HttpMethod.Post:
            args.push(bodyExpr ?? "null");
            break;
    }

    if (hasQueryParams) {
        args.push("{ params }");
    }

    return args;
}

function buildUrlExpression(template: PathTemplate, input: DescMessage): string {
    let url = "";
    for (const segment of template.segments) {
        url += "/";
        switch (segment.kind) {
            case PathSegmentKind.Literal:
                url += segment.value;
                break;
            case PathSegmentKind.Variable: {
                const field = input.fields.find((f) => f.name === segment.ident);
                if (field === undefined) {
                    throw Error(`field "${segment.ident}" not found in ${input.typeName}`);
                }
                url += `\${request.${field.localName}}`;
                break;
            }
        }
    }

    if (template.verb !== undefined) {
        url += `:${template.verb}`;
    }

    const hasVariables = template.segments.some((s) => s.kind === PathSegmentKind.Variable);

    return hasVariables ? `\`${url}\`` : `"${url}"`;
}

function lowercaseFirstChar(s: string): string {
    return s.charAt(0).toLowerCase() + s.slice(1);
}
