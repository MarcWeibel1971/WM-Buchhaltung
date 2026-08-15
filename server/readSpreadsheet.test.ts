import { describe, it, expect } from "vitest";
import { parseCsvText } from "../client/src/lib/readSpreadsheet";

describe("parseCsvText (CSV-Import)", () => {
  it("parst Semikolon-getrennte Zeilen (Excel-Standard CH/DE)", () => {
    const rows = parseCsvText("Name;Ort\nMüller AG;Luzern\nMeier;Zürich\n");
    expect(rows).toEqual([["Name", "Ort"], ["Müller AG", "Luzern"], ["Meier", "Zürich"]]);
  });

  it("parst Komma-getrennte Zeilen", () => {
    const rows = parseCsvText("Name,Ort\nMüller AG,Luzern\n");
    expect(rows).toEqual([["Name", "Ort"], ["Müller AG", "Luzern"]]);
  });

  it("behandelt quoted Felder mit Delimiter und escaped Quotes", () => {
    const rows = parseCsvText('Name;Notiz\n"Müller; AG""Neu""";"Zeile mit; Strichpunkt"\n');
    expect(rows[1]).toEqual(['Müller; AG"Neu"', "Zeile mit; Strichpunkt"]);
  });

  it("ignoriert Leerzeilen und unterstützt CRLF", () => {
    const rows = parseCsvText("A;B\r\n\r\n1;2\r\n\n3;4");
    expect(rows).toEqual([["A", "B"], ["1", "2"], ["3", "4"]]);
  });

  it("behandelt Tab als Delimiter", () => {
    const rows = parseCsvText("A\tB\n1\t2\n");
    expect(rows).toEqual([["A", "B"], ["1", "2"]]);
  });
});
