/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 /*
 Intermediate V1 struct
    |header|data|

    header(5 byte) =>>
        |type|size|
        
        type: 1 byte
        size: 4 byte

    data =>>
        if data's type is map or list, size is elements count of data
        otherwise, size is memory length of data

 */

declare var useLittleEndian: boolean;

declare namespace NB {
    namespace IntermediateV1Codec {
        function decode(data: ArrayBuffer): any;
        function encode(raw: any): Blob;
    }

    namespace IntermediateV2Codec {
        function decode(data: ArrayBuffer): any;
        function encode(raw: any): Blob;
    }
}