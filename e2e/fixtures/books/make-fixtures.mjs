// Writes the small books e2e/reader.spec.ts uploads (PRD.md READ-1 to READ-8):
// one per format, plus an EPUB that carries scripts to prove they never run.
// The text is written for these tests. No dependency: a ZIP with stored
// entries and a two page PDF are simple enough to write by hand, so the files
// can be made again with `node e2e/fixtures/books/make-fixtures.mjs`.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A ZIP whose entries are stored uncompressed, in the given order. */
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, content] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, ...centrals, end]);
}

const paragraphs = [
  "Kebanyakan dari kita belajar dengan membaca ulang. Catatan dibuka, kalimat penting distabilo, lalu dibaca lagi sampai terasa akrab.",
  "Rasa akrab itu menipu. Kita mengira sudah paham karena kalimatnya terasa familier, padahal yang terjadi baru mengenali, belum mengingat.",
  "Ingatan menguat justru saat kita berusaha memanggilnya. Tutup buku, lalu tanyakan pada diri sendiri: tadi bab ini membahas apa?",
  "Karena itu, kuis kecil lebih berguna daripada membaca ulang tiga kali. Jawaban yang salah pun tetap membantu, asal kita segera melihat jawaban yang benar.",
  "Jarak juga berperan. Mengulang materi besok, lalu tiga hari lagi, lalu seminggu kemudian, terasa lebih berat, dan beratnya itulah yang membuat materi bertahan.",
];

const chapter = (title, body, extraHead = "") => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="id" lang="id">
<head><title>${title}</title><link rel="stylesheet" type="text/css" href="gaya.css"/>${extraHead}</head>
<body><h1>${title}</h1>
${body}
</body></html>`;

function epub({ title, chapters }) {
  const manifest = chapters
    .map((_, index) => `<item id="bab${index + 1}" href="bab${index + 1}.xhtml" media-type="application/xhtml+xml"/>`)
    .join("\n    ");
  const spine = chapters.map((_, index) => `<itemref idref="bab${index + 1}"/>`).join("\n    ");
  const navItems = chapters
    .map((item, index) => `<li><a href="bab${index + 1}.xhtml">${item.title}</a></li>`)
    .join("");

  return zip([
    ["mimetype", "application/epub+zip"],
    [
      "META-INF/container.xml",
      `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
    ],
    [
      "OEBPS/content.opf",
      `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:7d1c0c6e-1b0a-4a5e-9a51-ruangbaca</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:language>id</dc:language>
    <meta property="dcterms:modified">2026-11-17T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="gaya" href="gaya.css" media-type="text/css"/>
    ${manifest}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`,
    ],
    [
      "OEBPS/nav.xhtml",
      `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="id">
<head><title>Daftar isi</title></head>
<body><nav epub:type="toc"><ol>${navItems}</ol></nav></body></html>`,
    ],
    [
      "OEBPS/gaya.css",
      "body { font-family: serif; color: #3a2a20; background: #fbf6ea; } h1 { color: #7a2e2e; text-align: center; } p { text-indent: 1.4em; margin: 0; }",
    ],
    ...chapters.map((item, index) => [`OEBPS/bab${index + 1}.xhtml`, chapter(item.title, item.body, item.head ?? "")]),
  ]);
}

const prose = (from, to) => paragraphs.slice(from, to).map((text) => `<p>${text}</p>`).join("\n");

writeFileSync(
  join(here, "catatan-kecil.epub"),
  epub({
    title: "Catatan Kecil tentang Ingatan",
    chapters: [
      { title: "Bab 1: Membaca ulang", body: prose(0, 3) },
      { title: "Bab 2: Mengingat adalah latihan", body: prose(2, 5) },
    ],
  }),
);

// Every way a book could try to run code. The reader must stop all of them (READ-8).
writeFileSync(
  join(here, "buku-berskrip.epub"),
  epub({
    title: "Buku Berskrip",
    chapters: [
      {
        title: "Bab berbahaya",
        head: '<script type="text/javascript">window.top.document.title = "SKRIP-JALAN";</script>',
        body: `${prose(0, 2)}
<p><img src="tidak-ada.png" alt="gambar" onerror="window.top.document.title = 'ONERROR-JALAN'"/></p>
<p><a href="javascript:window.top.document.title='TAUTAN-JALAN'">Tautan</a></p>`,
      },
    ],
  }),
);

writeFileSync(
  join(here, "modul.docx"),
  zip([
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    ],
    [
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.map((text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`).join("\n    ")}
  </w:body>
</w:document>`,
    ],
  ]),
);

writeFileSync(join(here, "catatan.txt"), `${paragraphs.join("\n\n")}\n`, "utf8");

/** A two page PDF with Helvetica text, cross reference offsets counted in bytes. */
function pdf(pages) {
  const objects = [];
  const pageIds = pages.map((_, index) => 3 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  const fontId = 3 + pages.length * 2;

  pages.forEach((text, index) => {
    const stream = `BT /F1 16 Tf 30 340 Td (${text}) Tj ET`;
    objects[3 + index * 2] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${4 + index * 2} 0 R >>`;
    objects[4 + index * 2] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let body = "%PDF-1.4\n";
  const offsets = [];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(body);
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefAt = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  return Buffer.from(body, "latin1");
}

writeFileSync(join(here, "dua-halaman.pdf"), pdf(["Halaman satu tentang ingatan", "Halaman dua tentang jarak"]));

console.log("wrote the reader test books");
