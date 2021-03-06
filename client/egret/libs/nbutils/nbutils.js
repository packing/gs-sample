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
var useLittleEndian = false;


var NBPy = {
    typeof: function (o) {
        var r = Object.prototype.toString.call(o);
        r = r.substring(8, r.length - 1).toLowerCase();
        if (r == "number") {
            if (("" + o).indexOf(".") > 0 && ("" + o).indexOf("e") <= 0) {
                r = "float";
            }
            else if (o > 0xFFFFFFFF) {
                r = "number64";
            }
        }
        return r;
    },
    UTF8: function (str) {
        var code = encodeURIComponent(str);
        var bytes = [];
        for (var i = 0; i < code.length; i++) {
            var c = code.charAt(i);
            if (c === '%') {
                var hex = code.charAt(i + 1) + code.charAt(i + 2);
                var hexVal = parseInt(hex, 16);
                bytes.push(hexVal);
                i += 2;
            }
            else
                bytes.push(c.charCodeAt(0));
        }
        var dv = new DataView(new ArrayBuffer(bytes.length));
        for (var i = 0; i < bytes.length; i++) {
            dv.setUint8(i, bytes[i]);
        }
        return dv;
    },
    UNICODE: function (dv, offset, count) {
        var encoded = "";
        for (var i = 0; i < count; i++) {
            var bytec = dv.getUint8(offset + i, useLittleEndian);
            encoded += '%' + bytec.toString(16);
        }
        return decodeURIComponent(encoded);
    },
    UINT64: function (dataview, byteOffset) {
        // split 64-bit number into two 32-bit (4-byte) parts
        const left =  dataview.getUint32(byteOffset, useLittleEndian);
        const right = dataview.getUint32(byteOffset+4, useLittleEndian);
        // combine the two 32-bit values
        const combined = useLittleEndian? left + 2**32*right : 2**32*left + right;
        if (!Number.isSafeInteger(combined))
          console.warn(combined, 'exceeds MAX_SAFE_INTEGER. Precision may be lost');
        return combined;
    }
};
var IMDataHeaderLength = 1 + 4;
var IntermediateTypes = {
    Unknown: 0,
    Int: 1,
    Int64: 2,
    Str: 3,
    Float: 4,
    Bool: 5,
    Double: 6,
    Map: 7,
    List: 8,
    Buffer: 9,
    PBuffer: 10,
    Memory: 11,
    PyStr: 12,
    Long: 13,
    Short: 14,
    Char: 15,
};
var IntermediateLengths = {
    "number": function (v) { return 4; },
    "number64": function (v) { return 8; },
    "float": function (v) { return 4; },
    "boolean": function (v) { return 1; },
    "string": function (v) { return v.length * 2; },
    "object": function (v) { var l = 0; for (var k in v)
        l++; return l; },
    "array": function (v) { return v.length; },
};
var TypeSwapTables = {
    "number": "Int",
    "number64": "Int64",
    "string": "Str",
    "float": "Float",
    "boolean": "Bool",
    "object": "Map",
    "array": "List",
};
var safeNaN = function (v) {
    if (isNaN(v)) {
        return v;
    }
    if (("" + v).indexOf(".") > 0 && ("" + v).indexOf("e") <= 0) {
        return parseFloat(v);
    }
    else {
        return parseInt(v);
    }
};
var IntermediateV1Codec = {
    decode: function (data) {
        var _fnDecodeValue = function (dv, tp, l, __offset) {
            var _offset = __offset;
            switch (tp) {
                case IntermediateTypes.Int:
                    return { 'o': dv.getInt32(_offset, true), 'offset': _offset + l };
                case IntermediateTypes.Short:
                    return { 'o': dv.getInt16(_offset, true), 'offset': _offset + l };
                case IntermediateTypes.Char:
                    return { 'o': dv.getInt8(_offset, true), 'offset': _offset + l };
                case IntermediateTypes.Int64:
                    return { 'o': dv.getFloat64(_offset, true), 'offset': _offset + l };
                case IntermediateTypes.Float:
                    return { 'o': dv.getFloat32(_offset, true), 'offset': _offset + l };
                case IntermediateTypes.Bool:
                    return { 'o': dv.getUint8(_offset, true) == 1, 'offset': _offset + l };
                case IntermediateTypes.Str:
                    var s = "";
                    for (var i = 0; i < l; i++) {
                        s += String.fromCharCode(dv.getUint16(_offset + i, true));
                        i++; //unicode char need uint16, size > 2
                    }
                    return { 'o': s, 'offset': _offset + l };
                case IntermediateTypes.Map:
                    var ret = {};
                    for (var i = 0; i < l; i++) {
                        var kv = _fnDecodeKV(dv, _offset);
                        _offset = kv.offset;
                        ret[kv.o.key] = kv.o.val;
                    }
                    return { 'o': ret, 'offset': _offset };
                case IntermediateTypes.List:
                    var readed = 0;
                    var ret = new Array();
                    for (var i = 0; i < l; i++) {
                        var v = _fnDecode(dv, _offset);
                        _offset = v.offset;
                        ret.push(v.o);
                    }
                    return { 'o': ret, 'offset': _offset };
                default:
                    return { 'o': null, 'offset': _offset };
            }
        };
        var _fnDecodeKV = function (dv, __offset) {
            var ktp = dv.getUint8(__offset, true);
            var kl = dv.getUint32(__offset + 1, true);
            var vtp = dv.getUint8(__offset + 5, true);
            var vl = dv.getUint32(__offset + 6, true);
            var _offset = __offset + 10;
            var k = _fnDecodeValue(dv, ktp, kl, _offset);
            _offset = k.offset;
            if (vtp == IntermediateTypes.Map || vtp == IntermediateTypes.List) {
                vl = dv.getUint32(_offset + 1, true);
                _offset += 5;
            }
            var v = _fnDecodeValue(dv, vtp, vl, _offset);
            var o = { 'key': k.o, 'val': v.o };
            return { 'o': o, 'offset': v.offset };
        };
        var _fnDecode = function (dv, __offset) {
            var tp = dv.getUint8(__offset, true);
            var l = dv.getUint32(__offset + 1, true);
            var _offset = __offset + 5;
            return _fnDecodeValue(dv, tp, l, _offset);
        };
        var dv = new DataView(data);
        var obj = _fnDecode(dv, 0);
        return obj.o;
    },
    encode: function (raw) {
        var _fnEncodeHeader = function (val) {
            var srcType = NBPy.typeof(val);
            var dstType = IntermediateTypes[TypeSwapTables[srcType]];
            if (dstType == undefined) {
                console.log("Cannot encode of data type [" + srcType + "]");
                return null;
            }
            var sizefn = IntermediateLengths[srcType];
            if (sizefn == undefined) {
                console.log("Cannot encode of unknown data size");
                return null;
            }
            var size = sizefn(val);
            var header = new DataView(new ArrayBuffer(5));
            header.setInt8(0, dstType, true);
            header.setInt32(1, size, true);
            return header;
        };
        var _fnEncodeData = function (header, val) {
            var dstType = header.getInt8(0, true);
            var size = header.getInt32(1, true);
            if (size == 0) {
                console.log("The val length is zero");
                return null;
            }
            var data = new DataView(new ArrayBuffer(size));
            switch (dstType) {
                case IntermediateTypes.Int:
                    data.setInt32(0, val, true);
                    break;
                case IntermediateTypes.Int64:
                    data.setFloat64(0, val, true);
                    break;
                case IntermediateTypes.Float:
                    data.setFloat32(0, val, true);
                    break;
                case IntermediateTypes.Bool:
                    data.setUint8(0, val ? 1 : 0, true);
                    break;
                case IntermediateTypes.Str:
                    //for (var i=0; i<val.length; i++)
                    //    data.setUint16(i * 2, val.charCodeAt(i), true)
                    data = NBPy.UTF8(val);
                    header.setInt32(1, data.byteLength);
                    break;
                case IntermediateTypes.Map:
                    {
                        var items = [];
                        var tt = 0;
                        for (var kk in val) {
                            var k = safeNaN(kk);
                            var _k = _fnEncodeHeader(k);
                            if (_k == null)
                                continue;
                            var _v = _fnEncodeHeader(val[k]);
                            if (_v == null)
                                continue;
                            var _kt = _fnEncodeData(_k, k);
                            if (_kt == null)
                                continue;
                            var vtp = _v.getInt8(0, true);
                            var _vt = (vtp == IntermediateTypes.Map || vtp == IntermediateTypes.List) ? _fnEncode(val[k]) : _fnEncodeData(_v, val[k]);
                            if (_vt == null)
                                continue;
                            _k = new Uint8Array(_k.buffer);
                            _v = new Uint8Array(_v.buffer);
                            var total = _k.byteLength + _v.byteLength + _kt.byteLength + _vt.byteLength;
                            var item = new Uint8Array(total);
                            var offset = 0;
                            item.set(_k, offset);
                            offset += _k.byteLength;
                            item.set(_v, offset);
                            offset += _v.byteLength;
                            item.set(_kt, offset);
                            offset += _kt.byteLength;
                            item.set(_vt, offset);
                            items.push(item);
                            tt += item.byteLength;
                        }
                        var sdata = new Uint8Array(tt);
                        var offset = 0;
                        for (var i in items) {
                            offset += i > 0 ? items[i - 1].byteLength : 0;
                            sdata.set(items[i], offset);
                        }
                        return sdata;
                    }
                case IntermediateTypes.List:
                    {
                        var items = [];
                        var tt = 0;
                        for (var k in val) {
                            var _v = _fnEncodeHeader(val[k]);
                            if (_v == null)
                                continue;
                            var vtp = _v.getInt8(0, true);
                            var _vt = (vtp == IntermediateTypes.Map || vtp == IntermediateTypes.List) ? _fnEncode(val[k]) : _fnEncodeData(_v, val[k]);
                            if (_vt == null)
                                continue;
                            _v = new Uint8Array(_v.buffer);
                            var total = _v.byteLength + _vt.byteLength;
                            var item = new Uint8Array(total);
                            var offset = 0;
                            item.set(_v, offset);
                            offset += _v.byteLength;
                            item.set(_vt, offset);
                            items.push(item);
                            tt += item.byteLength;
                        }
                        var sdata = new Uint8Array(tt);
                        var offset = 0;
                        for (var i in items) {
                            offset += i > 0 ? items[i - 1].byteLength : 0;
                            sdata.set(items[i], offset);
                        }
                        return sdata;
                    }
                default:
                    return null;
            }
            return new Uint8Array(data.buffer);
        };
        var _fnEncode = function (val) {
            header = _fnEncodeHeader(val);
            if (!header)
                return null;
            var bb = new Uint8Array(header.buffer);
            data = _fnEncodeData(header, val);
            header = bb;
            var finalsize = 0;
            finalsize += header.byteLength;
            if (data)
                finalsize += data.byteLength;
            var finaldata = new Uint8Array(finalsize);
            finaldata.set(header);
            if (data)
                finaldata.set(data, header.byteLength);
            return finaldata;
        };
        var finaldata = _fnEncode(raw);
        if (finaldata)
            return new Blob([finaldata.buffer]);
        return null;
    }
};
/*

 Intermediate V2 struct
    [header]|data|

    header ?????? >>
        ????????????????????????????????? <= 0x7f, ????????????????????????????????????????????????, ???????????????header, ????????????????????? char / int8
        ?????????????????????????????????????????? > 0x7f, ??????????????????????????????????????????????????????????????????????????????

            | | | | | | | |
            7 6 5 4 3 2 1 0

            ?????????????????? 7 ?????????1, ????????????????????????
            ??? 5-6 ?????????????????????????????????????????????, ???????????????:
                [ 0 0 ](0): ???????????????????????????????????????(??????????????????)
                [ 0 1 ](1): ??????????????????????????????????????????1???????????????(????????? 1 ~ 255?????????????????????????????????????????????????????????)
                [ 1 0 ](2): ??????????????????????????????????????????2???????????????(????????? 256 ~ 65,535)
                [ 1 1 ](3): ??????????????????????????????????????????4???????????????(????????? 65,536 ~ 4,294,967,295)

            ??? 0-4 ?????????????????????????????????, ???????????????????????????:
                [ 0 0 0 0 0 ](0):   ????????????                        (????????????????????????????????????, ??????????????????????????????)
                [ 0 0 0 0 1 ](1):   char / int8                     (?????????1????????????)
                [ 0 0 0 1 0 ](2):   unsigned char / uint8           (?????????1????????????)
                [ 0 0 0 1 1 ](3):   short / int16                   (?????????2????????????)
                [ 0 0 1 0 0 ](4):   unsigned short / uint16         (?????????2????????????)
                [ 0 0 1 0 1 ](5):   int / int32                     (?????????4????????????)
                [ 0 0 1 1 0 ](6):   unsigned int / uint32           (?????????4????????????)
                [ 0 0 1 1 1 ](7):   int64 / int64                   (?????????8????????????)
                [ 0 1 0 0 0 ](8):   unsigned int64 / uint64         (?????????8????????????)
                [ 0 1 0 0 1 ](9):   float / float32                 (4???????????????)
                [ 0 1 0 1 0 ](10):  double / float64                (8???????????????)
                [ 0 1 0 1 1 ](11):  reserved                        (??????????????????, fk)
                [ 0 1 1 0 0 ](12):  bool / bool true                (???????????? true)
                [ 0 1 1 0 1 ](13):  bool / bool false               (???????????? false)
                [ 0 1 1 1 0 ](14):  string / string                 (????????????!???????????????????????????)
                [ 0 1 1 1 1 ](15):  char[] / []byte                 (??????????????????!???????????????????????????)
                [ 1 0 0 0 0 ](16):  map / map                       (?????????????????????!????????????????????????????????????????????????)
                [ 1 0 0 0 1 ](17):  list / slice                    (?????????????????????!????????????????????????????????????????????????)

*/
var IntermediateV2Types = {
    Unknown: 0,
    Int8: 1,
    Uint8: 2,
    Int16: 3,
    Uint16: 4,
    Int32: 5,
    Uint32: 6,
    Int64: 7,
    Uint64: 8,
    Float32: 9,
    Float64: 10,
    Reserved: 11,
    True: 12,
    False: 13,
    String: 14,
    Bytes: 15,
    Map: 16,
    List: 17,
    BigNumber: 18,
};
var TypeSwapTablesV2 = {
    "number": "Int",
    "number64": "Int64",
    "string": "String",
    "float": "Float32",
    "true": "True",
    "false": "False",
    "object": "Map",
    "array": "List",
};
function calculateIMV2TypeSize(imtp) {
    switch (imtp) {
        case IntermediateV2Types.Int8:
        case IntermediateV2Types.Uint8:
            return 1;
        case IntermediateV2Types.Int16:
        case IntermediateV2Types.Uint16:
            return 2;
        case IntermediateV2Types.Float32:
        case IntermediateV2Types.Int32:
        case IntermediateV2Types.Uint32:
            return 4;
        case IntermediateV2Types.Float64:
        case IntermediateV2Types.Int64:
        case IntermediateV2Types.Uint64:
            return 8;
        default:
            return 0;
    }
}
var IntermediateV2Codec = {
    decode: function (data) {
        var _fnDecode = function (dv, offset) {
            if (dv.byteLength <= offset)
                return null;
            var fByte = dv.getUint8(offset, useLittleEndian);
            var _offset = offset + 1;
            var opCode = fByte >> 7;
            if (opCode == 0) {
                return { 'o': fByte, 'offset': _offset };
            }
            var elementType = fByte & 0x1f;
            var lenSizeType = (fByte >> 5) & 0x3;
            var elementCount = 0;
            switch (lenSizeType) {
                case 1:
                    if (dv.byteLength < 2)
                        return null;
                    elementCount = dv.getUint8(_offset, useLittleEndian);
                    _offset += 1;
                    break;
                case 2:
                    if (dv.byteLength < 3)
                        return null;
                    elementCount = dv.getUint16(_offset, useLittleEndian);
                    _offset += 2;
                    break;
                case 3:
                    if (dv.byteLength < 5)
                        return null;
                    elementCount = dv.getUint32(_offset, useLittleEndian);
                    _offset += 4;
                    break;
                default:
                    elementCount = calculateIMV2TypeSize(elementType);
            }
            if (elementType != IntermediateV2Types.Map && elementType != IntermediateTypes.List) {
                if (dv.byteLength - _offset < elementCount) {
                    return null;
                }
            }
            switch (elementType) {
                case IntermediateV2Types.Int8:
                    return { 'o': dv.getInt8(_offset, useLittleEndian), 'offset': _offset + 1 };
                case IntermediateV2Types.Uint8:
                    return { 'o': dv.getUint8(_offset, useLittleEndian), 'offset': _offset + 1 };
                case IntermediateV2Types.Int16:
                    return { 'o': dv.getInt16(_offset, useLittleEndian), 'offset': _offset + 2 };
                case IntermediateV2Types.Uint16:
                    return { 'o': dv.getUint16(_offset, useLittleEndian), 'offset': _offset + 2 };
                case IntermediateV2Types.Int32:
                    return { 'o': dv.getInt32(_offset, useLittleEndian), 'offset': _offset + 4 };
                case IntermediateV2Types.Uint32:
                    return { 'o': dv.getUint32(_offset, useLittleEndian), 'offset': _offset + 4 };
                case IntermediateV2Types.Float32:
                    return { 'o': dv.getFloat32(_offset, useLittleEndian), 'offset': _offset + 4 };
                case IntermediateV2Types.Int64:
                case IntermediateV2Types.Uint64:
                    return { 'o': NBPy.UINT64(dv, _offset), 'offset': _offset + 8 };
                case IntermediateV2Types.Float64:
                    return { 'o': dv.getFloat64(_offset, useLittleEndian), 'offset': _offset + 8 };
                case IntermediateV2Types.True:
                    return { 'o': true, 'offset': _offset };
                case IntermediateV2Types.False:
                    return { 'o': false, 'offset': _offset };
                case IntermediateV2Types.String:
                    var s = NBPy.UNICODE(dv, _offset, elementCount);
                    return { 'o': s, 'offset': _offset + elementCount };
                case IntermediateV2Types.BigNumber:
                    var s = NBPy.UNICODE(dv, _offset, elementCount);
                    return { 'o': parseInt(s, 10), 'offset': _offset + elementCount };
                case IntermediateV2Types.Bytes:
                    var bb = new Uint8Array(dv.buffer);
                    var s = bb.slice(_offset, elementCount);
                    return { 'o': s, 'offset': _offset + elementCount };
                case IntermediateV2Types.Map:
                    var dst = {};
                    for (var i = 0; i < elementCount; i++) {
                        var ko = _fnDecode(dv, _offset);
                        if (ko == null)
                            return null;
                        _offset = ko.offset;
                        var vo = _fnDecode(dv, _offset);
                        if (vo == null)
                            return null;
                        _offset = vo.offset;
                        dst[ko.o] = vo.o;
                    }
                    return { 'o': dst, 'offset': _offset };
                case IntermediateV2Types.List:
                    var dst = [];
                    for (var i = 0; i < elementCount; i++) {
                        var vo = _fnDecode(dv, _offset);
                        if (vo == null)
                            return null;
                        _offset = vo.offset;
                        dst.push(vo.o);
                    }
                    return { 'o': dst, 'offset': _offset };
                default:
                    return null;
            }
        };
        if (data.length < 1)
            return null;
        var dv = new DataView(data);
        var o = _fnDecode(dv, 0);
        if (o)
            return o.o;
        return null;
    },
    encode: function (raw) {
        var _fnMakeHeader = function (tp, lenSize) {
            var h = 0x80;
            h |= tp & 0x1f;
            switch (lenSize) {
                case 1:
                    h |= 0x20;
                    break;
                case 2:
                    h |= 0x40;
                    break;
                case 4:
                    h |= 0x60;
                    break;
                default:
            }
            return h;
        };
        var _fnMakeHeaderAndLength = function (tp, lenData) {
            var lenSize = 4;
            var lenb = lenData;
            if (lenb <= 0xff) {
                lenSize = 1;
                var header = new DataView(new ArrayBuffer(2));
                var h = _fnMakeHeader(tp, lenSize);
                header.setUint8(0, h, useLittleEndian);
                header.setUint8(1, lenb, useLittleEndian);
            }
            else if (lenb <= 0xffff) {
                lenSize = 2;
                var header = new DataView(new ArrayBuffer(3));
                var h = _fnMakeHeader(tp, lenSize);
                header.setUint8(0, h, useLittleEndian);
                header.setUint16(1, lenb, useLittleEndian);
            }
            else {
                lenSize = 4;
                var header = new DataView(new ArrayBuffer(5));
                var h = _fnMakeHeader(tp, lenSize);
                header.setUint8(0, h, useLittleEndian);
                header.setUint32(1, lenb, useLittleEndian);
            }
            return header;
        };
        var _fnEncode = function (o) {
            if (o == null)
                return null;
            var srcType = NBPy.typeof(o);
            //var dstType = dstType = IntermediateV2Types[TypeSwapTablesV2[srcType]];
            //if (dstType == undefined) {
            //    console.log("Cannot encode of data type [" + srcType + "]");
            //    return null;
            //}
            var sizefn = IntermediateLengths[srcType];
            var isInt = false;
            var isSign = false;
            var intRawValue = 0;
            var intValue = 0;
            switch (srcType) {
                case "number":
                    isInt = true;
                    intRawValue = o;
                    intValue = Math.abs(o);
                    isSign = intRawValue < 0;
                    break;
                case "number64":
                    data = NBPy.UTF8(o.toString());
                    var ss = data.byteLength;
                    var rb = _fnMakeHeaderAndLength(IntermediateV2Types.BigNumber, ss);
                    var buf = new Uint8Array(ss + rb.byteLength);
                    buf.set(new Uint8Array(rb.buffer));
                    buf.set(new Uint8Array(data.buffer), rb.byteLength);
                    return buf;
                case "float":
                    var rb = _fnMakeHeader(IntermediateV2Types.Float32, 0);
                    var buf = new DataView(new ArrayBuffer(5));
                    buf.setInt8(0, rb, useLittleEndian);
                    buf.setFloat32(1, o, useLittleEndian);
                    return buf;
                case "boolean":
                    var rb = _fnMakeHeader(o ? IntermediateV2Types.True : IntermediateV2Types.False, 0);
                    var buf = new DataView(new ArrayBuffer(1));
                    buf.setInt8(0, rb, useLittleEndian);
                    return buf;
                case "string":
                    data = NBPy.UTF8(o);
                    var ss = data.byteLength;
                    var rb = _fnMakeHeaderAndLength(IntermediateV2Types.String, ss);
                    /*var data = new DataView(new ArrayBuffer(ss));
                    for (var i=0; i<o.length; i++)
                        data.setUint16(i * 2, o.charCodeAt(i), useLittleEndian)
                    */
                    var buf = new Uint8Array(ss + rb.byteLength);
                    buf.set(new Uint8Array(rb.buffer));
                    buf.set(new Uint8Array(data.buffer), rb.byteLength);
                    return buf;
                case "object":
                    var items = [];
                    var tt = 0;
                    var i = 0;
                    for (var kk in o) {
                        var k = safeNaN(kk);
                        var kb = _fnEncode(k);
                        if (kb == null)
                            continue;
                        var vb = _fnEncode(o[kk]);
                        if (vb == null)
                            continue;
                        var tl = kb.byteLength + vb.byteLength;
                        var buf = new Uint8Array(tl);
                        buf.set(new Uint8Array(kb.buffer));
                        buf.set(new Uint8Array(vb.buffer), kb.byteLength);
                        items.push(buf);
                        tt += tl;
                        i++;
                    }
                    var rb = _fnMakeHeaderAndLength(IntermediateV2Types.Map, i);
                    var sdata = new Uint8Array(tt + rb.byteLength);
                    var offset = rb.byteLength;
                    sdata.set(new Uint8Array(rb.buffer));
                    for (var i in items) {
                        offset += i > 0 ? items[i - 1].byteLength : 0;
                        sdata.set(items[i], offset);
                    }
                    return sdata;
                case "array":
                    var items = [];
                    var tt = 0;
                    var i = 0;
                    for (var kk in o) {
                        var vb = _fnEncode(o[kk]);
                        if (vb == null)
                            continue;
                        items.push(vb);
                        tt += vb.byteLength;
                        i++;
                    }
                    var rb = _fnMakeHeaderAndLength(IntermediateV2Types.List, i);
                    var sdata = new Uint8Array(tt + rb.byteLength);
                    var offset = rb.byteLength;
                    sdata.set(new Uint8Array(rb.buffer));
                    for (var i in items) {
                        offset += i > 0 ? items[i - 1].byteLength : 0;
                        sdata.set(new Uint8Array(items[i].buffer), offset);
                    }
                    return sdata;
            }
            if (isInt) {
                //??????????????????
                if (isSign) {
                    var int8v = 0xff + 1 + intRawValue;
                    var int16v = 0xffff + 1 + intRawValue;
                    var int32v = 0xffffffff + 1 + intRawValue;
                    var rb = 0;
                    if (int8v >= 0 && int8v <= 0xff) {
                        rb = _fnMakeHeader(IntermediateV2Types.Int8, 0);
                        var buf = new DataView(new ArrayBuffer(2));
                        buf.setInt8(0, rb, useLittleEndian);
                        buf.setUint8(1, intValue, useLittleEndian);
                        return buf;
                    }
                    if (int16v >= 0 && int16v <= 0xffff) {
                        rb = _fnMakeHeader(IntermediateV2Types.Int16, 0);
                        var buf = new DataView(new ArrayBuffer(3));
                        buf.setInt8(0, rb, useLittleEndian);
                        buf.setUint16(1, intValue, useLittleEndian);
                        return buf;
                    }
                    if (int32v >= 0 && int32v <= 0xffffffff) {
                        rb = _fnMakeHeader(IntermediateV2Types.Int32, 0);
                        var buf = new DataView(new ArrayBuffer(5));
                        buf.setInt8(0, rb, useLittleEndian);
                        buf.setUint32(1, intValue, useLittleEndian);
                        return buf;
                    }
                }
                else {
                    if (intValue <= 0x7f) {
                        var buf = new DataView(new ArrayBuffer(1));
                        buf.setUint8(0, intValue, useLittleEndian);
                        return buf;
                    }
                    if (intValue <= 0xff) {
                        var buf = new DataView(new ArrayBuffer(2));
                        buf.setInt8(0, _fnMakeHeader(IntermediateV2Types.Uint8));
                        buf.setUint8(1, intValue, useLittleEndian);
                        return buf;
                    }
                    if (intValue <= 0xffff) {
                        var buf = new DataView(new ArrayBuffer(3));
                        buf.setInt8(0, _fnMakeHeader(IntermediateV2Types.Uint16));
                        buf.setUint16(1, intValue, useLittleEndian);
                        return buf;
                    }
                    if (intValue <= 0xffffffff) {
                        var buf = new DataView(new ArrayBuffer(5));
                        buf.setInt8(0, _fnMakeHeader(IntermediateV2Types.Uint32));
                        buf.setUint32(1, intValue, useLittleEndian);
                        return buf;
                    }
                }
            }
            return null;
        };
        var finaldata = _fnEncode(raw);
        if (finaldata)
            return new Blob([finaldata.buffer]);
        return null;
    },
};

var NB = {};
NB.IntermediateV1Codec = IntermediateV1Codec;
NB.IntermediateV2Codec = IntermediateV2Codec;