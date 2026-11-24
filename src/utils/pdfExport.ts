import { MachineConfig } from '../data/schedules';
import { countCheckedSlotsInRows, countTotalSlots } from './scheduleGenerator';
import { formatDateDisplayVN, formatTimeVN } from './vnTime';

interface PdfPageImage {
  width: number;
  height: number;
  jpegBytes: Uint8Array;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function buildMultiPagePdf(pages: PdfPageImage[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  let byteOffset = 0;

  const pushBytes = (b: Uint8Array) => {
    parts.push(b);
    byteOffset += b.length;
  };
  const pushText = (s: string) => {
    pushBytes(enc.encode(s));
  };

  // PDF 1.4 Header with binary marker comment
  pushText('%PDF-1.4\n');
  pushBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const totalObjects = 2 + pages.length * 3;
  const offsets: number[] = new Array(totalObjects + 1).fill(0);

  // Object 1: Catalog
  offsets[1] = byteOffset;
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages tree
  const kidRefs = pages.map((_, idx) => `${3 + idx * 3} 0 R`).join(' ');
  offsets[2] = byteOffset;
  pushText(`2 0 obj\n<< /Type /Pages /Kids [ ${kidRefs} ] /Count ${pages.length} >>\nendobj\n`);

  // Objects per page
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageObjId = 3 + i * 3;
    const contentObjId = pageObjId + 1;
    const imgObjId = pageObjId + 2;

    offsets[pageObjId] = byteOffset;
    pushText(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`
    );

    const streamBody = 'q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
    const streamBytes = enc.encode(streamBody);
    offsets[contentObjId] = byteOffset;
    pushText(`${contentObjId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
    pushBytes(streamBytes);
    pushText('\nendstream\nendobj\n');

    offsets[imgObjId] = byteOffset;
    pushText(
      `${imgObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`
    );
    pushBytes(page.jpegBytes);
    pushText('\nendstream\nendobj\n');
  }

  const xrefOffset = byteOffset;
  pushText(`xref\n0 ${totalObjects + 1}\n`);
  pushText('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjects; id++) {
    pushText(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return concatUint8Arrays(parts);
}

function drawCheckmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  checked: boolean
) {
  const size = 15;
  const x = cx - size / 2;
  const y = cy - size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 3.5);
  if (checked) {
    ctx.fillStyle = '#0D4EA6';
    ctx.fill();
    ctx.strokeStyle = '#0D4EA6';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 3.5, y + 7.8);
    ctx.lineTo(x + 6.4, y + 10.8);
    ctx.lineTo(x + 11.6, y + 4.4);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
}

export function exportSchedulePdf(
  machine: MachineConfig,
  slots: Record<string, boolean>,
  viewedDateKey: string
): { fileName: string; pageCount: number } {
  const PAGE_W = 1240;
  const PAGE_H = 1754;
  const MARGIN_X = 56;
  const TABLE_W = PAGE_W - MARGIN_X * 2; // 1128
  const ROWS_PER_PAGE = 52;

  const rows = machine.rows;
  const totalSelectable = countTotalSlots(rows);
  const totalChecked = countCheckedSlotsInRows(rows, slots).totalChecked;
  const dateDisplay = formatDateDisplayVN(viewedDateKey);
  const exportedAt = formatTimeVN(new Date());

  // Column x-positions
  const cols = [
    { key: 'stt', w: 84 },
    { key: 'ms', w: 192 },
    { key: 'me', w: 192 },
    { key: 'mp', w: 138 },
    { key: 'as', w: 192 },
    { key: 'ae', w: 192 },
    { key: 'ap', w: 138 },
  ];
  const colX: number[] = [];
  let accX = MARGIN_X;
  for (const c of cols) {
    colX.push(accX);
    accX += c.w;
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const renderedPages: PdfPageImage[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Trình duyệt không hỗ trợ tạo bản vẽ PDF.');
    }

    // White page background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    // Header block
    ctx.fillStyle = '#0D4EA6';
    ctx.font = '700 18px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('HOSPITAL PRO · KHOA CHẨN ĐOÁN HÌNH ẢNH', MARGIN_X, 46);

    ctx.fillStyle = '#083578';
    ctx.font = '800 28px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText(machine.fullTitle.toUpperCase(), MARGIN_X, 74);

    ctx.fillStyle = '#334155';
    ctx.font = '600 18px "Public Sans", Arial, sans-serif';
    ctx.fillText(
      `Phụ trách: ${machine.supervisor}   ·   Ngày lịch: ${dateDisplay}   ·   Xuất lúc: ${exportedAt}`,
      MARGIN_X,
      114
    );

    ctx.fillStyle = '#083578';
    ctx.font = '700 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Đã chọn: ${totalChecked} / ${totalSelectable} ca`, PAGE_W - MARGIN_X, 114);

    ctx.strokeStyle = '#0D4EA6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, 148);
    ctx.lineTo(PAGE_W - MARGIN_X, 148);
    ctx.stroke();

    // Table headers
    const headY = 164;
    const grpH = 30;
    const subH = 28;
    const rowH = 27.2;

    // Group row backgrounds
    ctx.fillStyle = '#DCEBFF';
    ctx.fillRect(colX[0], headY, cols[0].w, grpH + subH);
    ctx.fillStyle = '#D0E4FF';
    ctx.fillRect(colX[1], headY, cols[1].w + cols[2].w + cols[3].w, grpH);
    ctx.fillStyle = '#DCEBFF';
    ctx.fillRect(colX[4], headY, cols[4].w + cols[5].w + cols[6].w, grpH);

    // Subheader row backgrounds
    ctx.fillStyle = '#EEF5FF';
    ctx.fillRect(colX[1], headY + grpH, TABLE_W - cols[0].w, subH);

    // Header text
    ctx.fillStyle = '#083578';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 15px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText('STT', colX[0] + cols[0].w / 2, headY + (grpH + subH) / 2);
    ctx.fillText(
      'BUỔI SÁNG',
      colX[1] + (cols[1].w + cols[2].w + cols[3].w) / 2,
      headY + grpH / 2
    );
    ctx.fillText(
      'BUỔI CHIỀU',
      colX[4] + (cols[4].w + cols[5].w + cols[6].w) / 2,
      headY + grpH / 2
    );

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 14px "Public Sans", Arial, sans-serif';
    const subLabels = ['', 'TG bắt đầu', 'TG kết thúc', 'Chọn', 'TG bắt đầu', 'TG kết thúc', 'Chọn'];
    for (let c = 1; c < cols.length; c++) {
      ctx.fillText(subLabels[c], colX[c] + cols[c].w / 2, headY + grpH + subH / 2);
    }

    // Data rows
    const slice = rows.slice(pageIdx * ROWS_PER_PAGE, (pageIdx + 1) * ROWS_PER_PAGE);
    let curY = headY + grpH + subH;

    for (let rIdx = 0; rIdx < slice.length; rIdx++) {
      const r = slice[rIdx];
      const hasM = Boolean(r.morningStart);
      const hasA = Boolean(r.afternoonStart);
      const mChecked = hasM && Boolean(slots[`m:${r.stt}`]);
      const aChecked = hasA && Boolean(slots[`a:${r.stt}`]);

      // Row base tint
      ctx.fillStyle = '#F3F7FC';
      ctx.fillRect(colX[0], curY, cols[0].w, rowH);

      // Morning cells
      ctx.fillStyle = mChecked ? '#D2E5FF' : '#FFFFFF';
      ctx.fillRect(colX[1], curY, cols[1].w + cols[2].w + cols[3].w, rowH);

      // Afternoon cells
      ctx.fillStyle = aChecked ? '#D2E5FF' : '#F8FBFF';
      ctx.fillRect(colX[4], curY, cols[4].w + cols[5].w + cols[6].w, rowH);

      const midY = curY + rowH / 2;

      // STT
      ctx.fillStyle = '#083578';
      ctx.font = '700 15px "JetBrains Mono", monospace';
      ctx.fillText(String(r.stt), colX[0] + cols[0].w / 2, midY);

      // Morning Start & End
      ctx.fillStyle = hasM ? '#0F172A' : '#94A3B8';
      ctx.font = '800 15.5px "JetBrains Mono", monospace';
      ctx.fillText(hasM ? r.morningStart : '—', colX[1] + cols[1].w / 2, midY);
      ctx.fillStyle = hasM ? '#1E293B' : '#94A3B8';
      ctx.font = '600 15px "JetBrains Mono", monospace';
      ctx.fillText(hasM ? r.morningEnd : '—', colX[2] + cols[2].w / 2, midY);
      if (hasM) {
        drawCheckmark(ctx, colX[3] + cols[3].w / 2, midY, mChecked);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('—', colX[3] + cols[3].w / 2, midY);
      }

      // Afternoon Start & End
      ctx.fillStyle = hasA ? '#0F172A' : '#94A3B8';
      ctx.font = '800 15.5px "JetBrains Mono", monospace';
      ctx.fillText(hasA ? r.afternoonStart : '—', colX[4] + cols[4].w / 2, midY);
      ctx.fillStyle = hasA ? '#1E293B' : '#94A3B8';
      ctx.font = '600 15px "JetBrains Mono", monospace';
      ctx.fillText(hasA ? r.afternoonEnd : '—', colX[5] + cols[5].w / 2, midY);
      if (hasA) {
        drawCheckmark(ctx, colX[6] + cols[6].w / 2, midY, aChecked);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('—', colX[6] + cols[6].w / 2, midY);
      }

      // Row horizontal border
      ctx.strokeStyle = '#C7D6E8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, curY + rowH);
      ctx.lineTo(PAGE_W - MARGIN_X, curY + rowH);
      ctx.stroke();

      curY += rowH;
    }

    // Table vertical grid & outer frame
    const tableEndY = curY;
    ctx.strokeStyle = '#94B0D1';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(MARGIN_X, headY, TABLE_W, tableEndY - headY);

    // Horizontal lines inside header
    ctx.beginPath();
    ctx.moveTo(colX[1], headY + grpH);
    ctx.lineTo(PAGE_W - MARGIN_X, headY + grpH);
    ctx.moveTo(MARGIN_X, headY + grpH + subH);
    ctx.lineTo(PAGE_W - MARGIN_X, headY + grpH + subH);
    ctx.stroke();

    // Vertical column dividers
    for (let c = 1; c < cols.length; c++) {
      const startY = c === 1 || c === 4 ? headY : headY + grpH;
      ctx.strokeStyle = c === 1 || c === 4 ? '#94B0D1' : '#C7D6E8';
      ctx.lineWidth = c === 1 || c === 4 ? 1.4 : 1;
      ctx.beginPath();
      ctx.moveTo(colX[c], startY);
      ctx.lineTo(colX[c], tableEndY);
      ctx.stroke();
    }

    // Page footer
    ctx.fillStyle = '#475569';
    ctx.font = '500 14px "Public Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`Hospital Pro · Lịch giờ chụp X-quang (${machine.name})`, MARGIN_X, PAGE_H - 34);
    ctx.textAlign = 'right';
    ctx.fillText(`Trang ${pageIdx + 1} / ${totalPages}`, PAGE_W - MARGIN_X, PAGE_H - 34);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const b64 = dataUrl.split(',')[1] || '';
    renderedPages.push({
      width: PAGE_W,
      height: PAGE_H,
      jpegBytes: base64ToUint8Array(b64),
    });
  }

  const pdfBytes = buildMultiPagePdf(renderedPages);
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const fileName = `Lich-chup-X-quang-${machine.key}-${viewedDateKey}.pdf`;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);

  return { fileName, pageCount: renderedPages.length };
}
