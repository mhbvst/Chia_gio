import { MachineConfig, ScheduleRow } from '../data/schedules';
import { countCheckedSlotsInRows, countTotalSlots } from './scheduleGenerator';
import { formatDateDisplayVN, formatTimeVN } from './vnTime';

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tbl[i] = c >>> 0;
  }
  return tbl;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildStoreZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((now.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const data = entry.data;
    const sum = crc32(data);

    // Local file header (30 bytes + filename)
    const lh = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(lh);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // STORE (uncompressed)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, sum, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    const lhBytes = new Uint8Array(lh);
    lhBytes.set(nameBytes, 30);

    // Central directory header (46 bytes + filename)
    const ch = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(ch);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, sum, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    const chBytes = new Uint8Array(ch);
    chBytes.set(nameBytes, 46);

    localParts.push(lhBytes, data);
    centralParts.push(chBytes);
    offset += lhBytes.length + data.length;
  }

  let cdSize = 0;
  for (const c of centralParts) cdSize += c.length;

  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);
  const eocdBytes = new Uint8Array(eocd);

  const totalSize = offset + cdSize + eocdBytes.length;
  const out = new Uint8Array(new ArrayBuffer(totalSize));
  let pos = 0;
  for (const p of localParts) {
    out.set(p, pos);
    pos += p.length;
  }
  for (const p of centralParts) {
    out.set(p, pos);
    pos += p.length;
  }
  out.set(eocdBytes, pos);
  return out;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function strCell(ref: string, style: number, text: string): string {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`;
}

function numCell(ref: string, style: number, num: number): string {
  return `<c r="${ref}" s="${style}"><v>${num}</v></c>`;
}

export function buildScheduleXlsxBytes(
  machine: MachineConfig,
  slots: Record<string, boolean>,
  viewedDateKey: string,
  rowsOverride?: ScheduleRow[]
): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const rows = rowsOverride || machine.rows;
  const totalSelectable = countTotalSlots(rows);
  const totalChecked = countCheckedSlotsInRows(rows, slots).totalChecked;
  const dateDisplay = formatDateDisplayVN(viewedDateKey);
  const exportedAt = formatTimeVN(new Date());

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Lich X-quang" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="13"/><color rgb="FF083578"/><name val="Calibri"/></font>
    <font><sz val="10"/><color rgb="FF334155"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF083578"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCEBFF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEEF4FB"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD0E4FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F7FC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD2E5FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FBFF"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFB6CBE3"/></left>
      <right style="thin"><color rgb="FFB6CBE3"/></right>
      <top style="thin"><color rgb="FFB6CBE3"/></top>
      <bottom style="thin"><color rgb="FFB6CBE3"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

  const sheetRows: string[] = [];
  // Row 1: Title
  sheetRows.push(
    `<row r="1" ht="26" customHeight="1">${strCell(
      'A1',
      1,
      `HOSPITAL PRO – ${machine.fullTitle.toUpperCase()}`
    )}${strCell('B1', 1, '')}${strCell('C1', 1, '')}${strCell('D1', 1, '')}${strCell(
      'E1',
      1,
      ''
    )}${strCell('F1', 1, '')}${strCell('G1', 1, '')}</row>`
  );
  // Row 2: Subtitle
  sheetRows.push(
    `<row r="2" ht="20" customHeight="1">${strCell(
      'A2',
      2,
      `Phụ trách: ${machine.supervisor} · Ngày lịch: ${dateDisplay} · Đã chọn: ${totalChecked}/${totalSelectable} ca · Xuất lúc: ${exportedAt}`
    )}${strCell('B2', 2, '')}${strCell('C2', 2, '')}${strCell('D2', 2, '')}${strCell(
      'E2',
      2,
      ''
    )}${strCell('F2', 2, '')}${strCell('G2', 2, '')}</row>`
  );
  // Row 3: Spacer
  sheetRows.push(`<row r="3" ht="10" customHeight="1"/>`);
  // Row 4: Group Header
  sheetRows.push(
    `<row r="4" ht="22" customHeight="1">${strCell('A4', 3, 'STT')}${strCell(
      'B4',
      3,
      'BUỔI SÁNG'
    )}${strCell('C4', 3, '')}${strCell('D4', 3, '')}${strCell('E4', 3, 'BUỔI CHIỀU')}${strCell(
      'F4',
      3,
      ''
    )}${strCell('G4', 3, '')}</row>`
  );
  // Row 5: Subheader
  sheetRows.push(
    `<row r="5" ht="20" customHeight="1">${strCell('A5', 3, '')}${strCell(
      'B5',
      4,
      'TG bắt đầu'
    )}${strCell('C5', 4, 'TG kết thúc')}${strCell('D5', 4, 'Chọn')}${strCell(
      'E5',
      4,
      'TG bắt đầu'
    )}${strCell('F5', 4, 'TG kết thúc')}${strCell('G5', 4, 'Chọn')}</row>`
  );

  // Data rows start at Excel row 6
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const excelRow = i + 6;
    const hasM = Boolean(r.morningStart);
    const hasA = Boolean(r.afternoonStart);
    const mChecked = hasM && Boolean(slots[`m:${r.stt}`]);
    const aChecked = hasA && Boolean(slots[`a:${r.stt}`]);
    const mStyle = mChecked ? 7 : 6;
    const aStyle = aChecked ? 7 : 8;

    sheetRows.push(
      `<row r="${excelRow}" ht="19" customHeight="1">${numCell(
        `A${excelRow}`,
        5,
        r.stt
      )}${strCell(`B${excelRow}`, mStyle, r.morningStart)}${strCell(
        `C${excelRow}`,
        mStyle,
        r.morningEnd
      )}${strCell(`D${excelRow}`, mStyle, mChecked ? '✓' : '')}${strCell(
        `E${excelRow}`,
        aStyle,
        r.afternoonStart
      )}${strCell(`F${excelRow}`, aStyle, r.afternoonEnd)}${strCell(
        `G${excelRow}`,
        aStyle,
        aChecked ? '✓' : ''
      )}</row>`
    );
  }

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>
    <col min="1" max="1" width="10" customWidth="1"/>
    <col min="2" max="3" width="16" customWidth="1"/>
    <col min="4" max="4" width="11" customWidth="1"/>
    <col min="5" max="6" width="16" customWidth="1"/>
    <col min="7" max="7" width="11" customWidth="1"/>
  </cols>
  <sheetData>
    ${sheetRows.join('\n    ')}
  </sheetData>
  <mergeCells count="5">
    <mergeCell ref="A1:G1"/>
    <mergeCell ref="A2:G2"/>
    <mergeCell ref="A4:A5"/>
    <mergeCell ref="B4:D4"/>
    <mergeCell ref="E4:G4"/>
  </mergeCells>
</worksheet>`;

  return buildStoreZip([
    { name: '[Content_Types].xml', data: enc.encode(contentTypesXml) },
    { name: '_rels/.rels', data: enc.encode(rootRelsXml) },
    { name: 'xl/workbook.xml', data: enc.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRelsXml) },
    { name: 'xl/styles.xml', data: enc.encode(stylesXml) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheetXml) },
  ]);
}

export function exportScheduleExcel(
  machine: MachineConfig,
  slots: Record<string, boolean>,
  viewedDateKey: string,
  rowsOverride?: ScheduleRow[]
): { fileName: string; rowCount: number } {
  const bytes = buildScheduleXlsxBytes(machine, slots, viewedDateKey, rowsOverride);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const fileName = `Lich-chup-X-quang-${machine.key}-${viewedDateKey}.xlsx`;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);

  return { fileName, rowCount: (rowsOverride || machine.rows).length };
}
