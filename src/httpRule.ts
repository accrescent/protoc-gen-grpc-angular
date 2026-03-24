// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

import type { HttpRule } from "@buf/googleapis_googleapis.bufbuild_es/google/api/http_pb.js";

const IDENT_REGEX = /^([A-Za-z_])+([A-Za-z_0-9])*$/;
const LITERAL_REGEX = /^[A-Za-z0-9-._~]+$/;

export class SelectorSetError extends Error {}
export class ResponseBodySetError extends Error {}
export class UnsupportedMethodError extends Error {}
export class BodyOnBodilessMethodError extends Error {}
export class PatternMissingLeadingSlashError extends Error {}
export class InvalidBodyOptionError extends Error {}
export class NoPathSegmentsError extends Error {}
export class InvalidVerbError extends Error {}
export class InvalidVariableIdentError extends Error {}
export class InvalidSegmentError extends Error {}

export function parseHttpRule(rule: HttpRule): ParsedHttpRule {
    if (rule.selector !== "") {
        throw new SelectorSetError();
    } else if (rule.responseBody !== "") {
        throw new ResponseBodySetError();
    }

    switch (rule.pattern.case) {
        case "get":
        case "delete": {
            const method = rule.pattern.case === "get" ? HttpMethod.Get : HttpMethod.Delete;

            if (rule.body !== "") {
                throw new BodyOnBodilessMethodError();
            } else {
                return { method, template: parsePathTemplate(rule.pattern.value) };
            }
        }
        case "patch":
        case "post": {
            const method = rule.pattern.case === "patch" ? HttpMethod.Patch : HttpMethod.Post;

            return {
                method,
                template: parsePathTemplate(rule.pattern.value),
                bodyOption: parseBodyOption(rule.body),
            };
        }
        default:
            throw new UnsupportedMethodError();
    }
}

// Supported path template syntax in EBNF:
//
// template = "/" segments [ verb ] ;
// segments = segment { "/" segment } ;
// segment = literal | variable ;
// literal = letter | digit | "-" | "." | "_" | "~" ;
// variable = "{" ident [ "=" resource_pattern ] "}" ;
// resource_pattern = { any character except "{" and "}" } ;
// ident = letter { letter | digit } ;
// letter = "A" ... "Z" | "a" ... "z" | "_" ;
// digit = "0" ... "9" ;
// verb = ":" literal ;
//
// This syntax is a subset of that supported by HttpRule as defined at
// https://github.com/googleapis/googleapis/blob/6c3dce4/google/api/http.proto#L219-L226. We may
// support more HttpRule options in the future.
function parsePathTemplate(raw: string): PathTemplate {
    if (!raw.startsWith("/")) {
        throw new PatternMissingLeadingSlashError();
    }

    const rawSegments = splitPathSegments(raw.slice(1));

    const lastSegment = rawSegments.at(-1);
    if (lastSegment === undefined) {
        throw new NoPathSegmentsError();
    }

    let verb: string | undefined;
    const lastColonIndex = lastSegment.lastIndexOf(":");
    if (lastColonIndex !== -1) {
        verb = lastSegment.slice(lastColonIndex + 1);
        if (!LITERAL_REGEX.test(verb)) {
            throw new InvalidVerbError();
        }
        rawSegments[rawSegments.length - 1] = lastSegment.slice(0, lastColonIndex);
    }

    const segments = rawSegments.map(parseSegment);

    return verb !== undefined ? { segments, verb } : { segments };
}

function splitPathSegments(raw: string): string[] {
    const segments: string[] = [];
    let current = "";
    let braceDepth = 0;

    for (const char of raw) {
        if (char === "{") {
            braceDepth++;
            current += char;
        } else if (char === "}") {
            braceDepth--;
            current += char;
        } else if (char === "/" && braceDepth === 0) {
            if (current !== "") {
                segments.push(current);
            }
            current = "";
        } else {
            current += char;
        }
    }

    if (current !== "") {
        segments.push(current);
    }

    return segments;
}

function parseSegment(raw: string): PathSegment {
    if (raw.startsWith("{") && raw.endsWith("}")) {
        const inner = raw.slice(1, -1);
        const equalsIndex = inner.indexOf("=");
        const ident = equalsIndex !== -1 ? inner.slice(0, equalsIndex) : inner;
        if (IDENT_REGEX.test(ident)) {
            return { kind: PathSegmentKind.Variable, ident };
        } else {
            throw new InvalidVariableIdentError();
        }
    } else if (LITERAL_REGEX.test(raw)) {
        return { kind: PathSegmentKind.Literal, value: raw };
    } else {
        throw new InvalidSegmentError();
    }
}

function parseBodyOption(body: string): HttpBodyOption {
    switch (body) {
        case "":
            return HttpBodyOption.NoBody;
        case "*":
            return HttpBodyOption.AllUncapturedFields;
        default:
            throw new InvalidBodyOptionError();
    }
}

export enum HttpMethod {
    Get = "get",
    Delete = "delete",
    Patch = "patch",
    Post = "post",
}

export enum HttpBodyOption {
    NoBody,
    AllUncapturedFields,
}

export enum PathSegmentKind {
    Literal,
    Variable,
}

export interface LiteralSegment {
    kind: PathSegmentKind.Literal;
    value: string;
}

export interface VariableSegment {
    kind: PathSegmentKind.Variable;
    ident: string;
}

export type PathSegment = LiteralSegment | VariableSegment;

export interface PathTemplate {
    segments: PathSegment[];
    verb?: string;
}

export interface BodilessParsedHttpRule {
    method: HttpMethod.Get | HttpMethod.Delete;
    template: PathTemplate;
}

export interface BodiedParsedHttpRule {
    method: HttpMethod.Patch | HttpMethod.Post;
    template: PathTemplate;
    bodyOption: HttpBodyOption;
}

export type ParsedHttpRule = BodilessParsedHttpRule | BodiedParsedHttpRule;
