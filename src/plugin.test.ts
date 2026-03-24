// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

import { create, setExtension } from "@bufbuild/protobuf";
import {
    CodeGeneratorRequestSchema,
    FileDescriptorProtoSchema,
    MethodOptionsSchema,
    ServiceOptionsSchema,
    file_google_protobuf_descriptor,
    file_google_protobuf_duration,
} from "@bufbuild/protobuf/wkt";
import {
    file_google_api_annotations,
    http,
} from "@buf/googleapis_googleapis.bufbuild_es/google/api/annotations_pb.js";
import {
    default_host,
    file_google_api_client,
} from "@buf/googleapis_googleapis.bufbuild_es/google/api/client_pb.js";
import { file_google_api_launch_stage } from "@buf/googleapis_googleapis.bufbuild_es/google/api/launch_stage_pb.js";
import {
    HttpRuleSchema,
    file_google_api_http,
} from "@buf/googleapis_googleapis.bufbuild_es/google/api/http_pb.js";
import { describe, expect, test } from "vitest";

import { plugin } from "./plugin.js";

function generate(
    methods: {
        name: string;
        clientStreaming?: boolean;
        serverStreaming?: boolean;
        hasHttpAnnotation?: boolean;
    }[],
    parameter = "target=ts",
    defaultHostValue?: string,
): string | undefined {
    const methodOptions = create(MethodOptionsSchema);
    setExtension(
        methodOptions,
        http,
        create(HttpRuleSchema, { pattern: { case: "get", value: "/v1/test" } }),
    );

    let serviceOptions;
    if (defaultHostValue !== undefined) {
        serviceOptions = create(ServiceOptionsSchema);
        setExtension(serviceOptions, default_host, defaultHostValue);
    }

    const file = create(FileDescriptorProtoSchema, {
        name: "test.proto",
        package: "test",
        syntax: "proto3",
        dependency: ["google/api/annotations.proto", "google/api/client.proto"],
        messageType: [{ name: "TestRequest" }, { name: "TestResponse" }],
        service: [
            {
                name: "TestService",
                ...(serviceOptions !== undefined && { options: serviceOptions }),
                method: methods.map((m) => {
                    const base = {
                        name: m.name,
                        inputType: ".test.TestRequest",
                        outputType: ".test.TestResponse",
                        clientStreaming: m.clientStreaming ?? false,
                        serverStreaming: m.serverStreaming ?? false,
                    };
                    return (m.hasHttpAnnotation ?? true)
                        ? { ...base, options: methodOptions }
                        : base;
                }),
            },
        ],
    });

    const request = create(CodeGeneratorRequestSchema, {
        parameter,
        fileToGenerate: ["test.proto"],
        protoFile: [
            file_google_protobuf_descriptor.proto,
            file_google_api_http.proto,
            file_google_api_annotations.proto,
            file_google_protobuf_duration.proto,
            file_google_api_launch_stage.proto,
            file_google_api_client.proto,
            file,
        ],
    });

    const response = plugin.run(request);
    return response.file.find((f) => f.name?.endsWith("test_ng.ts"))?.content;
}

describe("plugin", () => {
    test.each([
        ["client streaming", true, false],
        ["server streaming", false, true],
        ["bidirectional streaming", true, true],
    ] as const)("skips %s methods", (_label, clientStreaming, serverStreaming) => {
        const content = generate([
            { name: "UnaryMethod" },
            { name: "StreamMethod", clientStreaming, serverStreaming },
        ]);

        expect(content).toBeDefined();
        expect(content).toContain("unaryMethod");
        expect(content).not.toContain("streamMethod");
    });

    test("skips services with no unary methods", () => {
        const content = generate([{ name: "StreamMethod", serverStreaming: true }]);

        expect(content).toBeUndefined();
    });

    test("uses valid response types when valid_responses is true", () => {
        const content = generate([{ name: "UnaryMethod" }], "target=ts,valid_responses=true");

        expect(content).toBeDefined();
        expect(content).toContain(
            "unaryMethod(request: TestRequest): Observable<TestResponseValid>",
        );
    });

    test("does not use valid response types without valid_responses", () => {
        const content = generate([{ name: "UnaryMethod" }]);

        expect(content).toBeDefined();
        expect(content).toContain("unaryMethod(request: TestRequest): Observable<TestResponse>");
    });

    test("skips unary methods without HTTP annotation", () => {
        const content = generate([
            { name: "UnaryMethod" },
            { name: "UnannotatedMethod", hasHttpAnnotation: false },
        ]);

        expect(content).toBeDefined();
        expect(content).toContain("unaryMethod");
        expect(content).not.toContain("unannotatedMethod");
    });

    test("skips service when all unary methods lack HTTP annotations", () => {
        const content = generate([{ name: "UnannotatedMethod", hasHttpAnnotation: false }]);

        expect(content).toBeUndefined();
    });

    test("uses default_host as base URL fallback when present", () => {
        const content = generate([{ name: "UnaryMethod" }], "target=ts", "api.example.com");

        expect(content).toBeDefined();
        expect(content).toContain(
            'private readonly baseUrl = inject(NG_TEST_SERVICE_BASE_URL, { optional: true }) ?? "https://api.example.com";',
        );
    });

    test("uses empty string as base URL fallback when default_host is absent", () => {
        const content = generate([{ name: "UnaryMethod" }]);

        expect(content).toBeDefined();
        expect(content).toContain(
            'private readonly baseUrl = inject(NG_TEST_SERVICE_BASE_URL, { optional: true }) ?? "";',
        );
    });
});
