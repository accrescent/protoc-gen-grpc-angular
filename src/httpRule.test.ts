// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

import { create } from "@bufbuild/protobuf";
import { HttpRuleSchema } from "@buf/googleapis_googleapis.bufbuild_es/google/api/http_pb.js";
import { describe, expect, test } from "vitest";

import {
    BodyOnBodilessMethodError,
    HttpBodyOption,
    HttpMethod,
    InvalidBodyOptionError,
    InvalidSegmentError,
    InvalidVariableIdentError,
    InvalidVerbError,
    PatternMissingLeadingSlashError,
    PathSegmentKind,
    ResponseBodySetError,
    SelectorSetError,
    UnsupportedMethodError,
    parseHttpRule,
} from "./httpRule.js";

function expectParseError(
    fn: () => void,
    ErrorClass: abstract new (...args: never[]) => Error,
): void {
    try {
        fn();
        expect.unreachable("expected ParseError to be thrown");
    } catch (e) {
        expect(e).toBeInstanceOf(ErrorClass);
    }
}

describe("parseHttpRule", () => {
    // Method parsing
    test("parses GET method", () => {
        const result = parseHttpRule(
            create(HttpRuleSchema, { pattern: { case: "get", value: "/v1" } }),
        );
        expect(result.method).toBe(HttpMethod.Get);
    });

    test("parses DELETE method", () => {
        const result = parseHttpRule(
            create(HttpRuleSchema, { pattern: { case: "delete", value: "/v1" } }),
        );
        expect(result.method).toBe(HttpMethod.Delete);
    });

    test("parses PATCH method", () => {
        const result = parseHttpRule(
            create(HttpRuleSchema, { pattern: { case: "patch", value: "/v1" } }),
        );
        expect(result.method).toBe(HttpMethod.Patch);
    });

    test("parses POST method", () => {
        const result = parseHttpRule(
            create(HttpRuleSchema, { pattern: { case: "post", value: "/v1" } }),
        );
        expect(result.method).toBe(HttpMethod.Post);
    });

    test("rejects PUT method", () => {
        expectParseError(
            () => parseHttpRule(create(HttpRuleSchema, { pattern: { case: "put", value: "/v1" } })),
            UnsupportedMethodError,
        );
    });

    test("rejects custom method", () => {
        expectParseError(
            () =>
                parseHttpRule(
                    create(HttpRuleSchema, {
                        pattern: { case: "custom", value: { kind: "HEAD", path: "/v1" } },
                    }),
                ),
            UnsupportedMethodError,
        );
    });

    // Pattern parsing
    test("parses literal segments", () => {
        const result = parseHttpRule(
            create(HttpRuleSchema, { pattern: { case: "get", value: "/v1/apps" } }),
        );
        expect(result.template.segments).toEqual([
            { kind: PathSegmentKind.Literal, value: "v1" },
            { kind: PathSegmentKind.Literal, value: "apps" },
        ]);
    });

    test("parses variable segment", () => {
        const result = parseHttpRule(
            create(HttpRuleSchema, { pattern: { case: "get", value: "/v1/{app_id}" } }),
        );
        expect(result.template.segments).toEqual([
            { kind: PathSegmentKind.Literal, value: "v1" },
            { kind: PathSegmentKind.Variable, ident: "app_id" },
        ]);
    });

    test("parses verb", () => {
        const result = parseHttpRule(
            create(HttpRuleSchema, { pattern: { case: "post", value: "/v1/apps:submit" } }),
        );
        expect(result.template.verb).toBe("submit");
    });

    test("omits verb when absent", () => {
        const result = parseHttpRule(
            create(HttpRuleSchema, { pattern: { case: "get", value: "/v1/apps" } }),
        );
        expect(result.template.verb).toBeUndefined();
    });

    test("rejects pattern not starting with /", () => {
        expectParseError(
            () => parseHttpRule(create(HttpRuleSchema, { pattern: { case: "get", value: "v1" } })),
            PatternMissingLeadingSlashError,
        );
    });

    test("rejects empty verb after colon", () => {
        expectParseError(
            () =>
                parseHttpRule(
                    create(HttpRuleSchema, { pattern: { case: "get", value: "/v1/apps:" } }),
                ),
            InvalidVerbError,
        );
    });

    test("rejects invalid variable ident", () => {
        expectParseError(
            () =>
                parseHttpRule(
                    create(HttpRuleSchema, { pattern: { case: "get", value: "/v1/{123}" } }),
                ),
            InvalidVariableIdentError,
        );
    });

    test("rejects invalid segment", () => {
        expectParseError(
            () =>
                parseHttpRule(
                    create(HttpRuleSchema, { pattern: { case: "get", value: "/v1/he llo" } }),
                ),
            InvalidSegmentError,
        );
    });

    // Body parsing
    test("parses empty body as NoBody", () => {
        const result = parseHttpRule(
            create(HttpRuleSchema, { pattern: { case: "post", value: "/v1" }, body: "" }),
        );
        expect((result as { bodyOption: HttpBodyOption }).bodyOption).toBe(HttpBodyOption.NoBody);
    });

    test("parses * body as AllUncapturedFields", () => {
        const result = parseHttpRule(
            create(HttpRuleSchema, { pattern: { case: "post", value: "/v1" }, body: "*" }),
        );
        expect((result as { bodyOption: HttpBodyOption }).bodyOption).toBe(
            HttpBodyOption.AllUncapturedFields,
        );
    });

    test("rejects named body field", () => {
        expectParseError(
            () =>
                parseHttpRule(
                    create(HttpRuleSchema, {
                        pattern: { case: "post", value: "/v1" },
                        body: "field_name",
                    }),
                ),
            InvalidBodyOptionError,
        );
    });

    test("rejects body on GET", () => {
        expectParseError(
            () =>
                parseHttpRule(
                    create(HttpRuleSchema, { pattern: { case: "get", value: "/v1" }, body: "*" }),
                ),
            BodyOnBodilessMethodError,
        );
    });

    test("rejects body on DELETE", () => {
        expectParseError(
            () =>
                parseHttpRule(
                    create(HttpRuleSchema, {
                        pattern: { case: "delete", value: "/v1" },
                        body: "*",
                    }),
                ),
            BodyOnBodilessMethodError,
        );
    });

    // Unsupported fields
    test("rejects non-empty selector", () => {
        expectParseError(
            () =>
                parseHttpRule(
                    create(HttpRuleSchema, {
                        selector: "foo",
                        pattern: { case: "get", value: "/v1" },
                    }),
                ),
            SelectorSetError,
        );
    });

    test("rejects non-empty response body", () => {
        expectParseError(
            () =>
                parseHttpRule(
                    create(HttpRuleSchema, {
                        pattern: { case: "get", value: "/v1" },
                        responseBody: "result",
                    }),
                ),
            ResponseBodySetError,
        );
    });
});
