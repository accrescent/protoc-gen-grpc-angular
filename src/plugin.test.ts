// SPDX-FileCopyrightText: © 2026 Logan Magee
//
// SPDX-License-Identifier: Apache-2.0

import { create, setExtension } from "@bufbuild/protobuf";
import {
    CodeGeneratorRequestSchema,
    FileDescriptorProtoSchema,
    MethodOptionsSchema,
    file_google_protobuf_descriptor,
} from "@bufbuild/protobuf/wkt";
import {
    file_google_api_annotations,
    http,
} from "@buf/googleapis_googleapis.bufbuild_es/google/api/annotations_pb.js";
import {
    HttpRuleSchema,
    file_google_api_http,
} from "@buf/googleapis_googleapis.bufbuild_es/google/api/http_pb.js";
import { describe, expect, test } from "vitest";

import { plugin } from "./plugin.js";

function generate(
    methods: { name: string; clientStreaming?: boolean; serverStreaming?: boolean }[],
): string | undefined {
    const options = create(MethodOptionsSchema);
    setExtension(
        options,
        http,
        create(HttpRuleSchema, { pattern: { case: "get", value: "/v1/test" } }),
    );

    const file = create(FileDescriptorProtoSchema, {
        name: "test.proto",
        package: "test",
        syntax: "proto3",
        dependency: ["google/api/annotations.proto"],
        messageType: [{ name: "TestRequest" }, { name: "TestResponse" }],
        service: [
            {
                name: "TestService",
                method: methods.map((m) => ({
                    name: m.name,
                    inputType: ".test.TestRequest",
                    outputType: ".test.TestResponse",
                    options,
                    clientStreaming: m.clientStreaming ?? false,
                    serverStreaming: m.serverStreaming ?? false,
                })),
            },
        ],
    });

    const request = create(CodeGeneratorRequestSchema, {
        parameter: "target=ts",
        fileToGenerate: ["test.proto"],
        protoFile: [
            file_google_protobuf_descriptor.proto,
            file_google_api_http.proto,
            file_google_api_annotations.proto,
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
});
