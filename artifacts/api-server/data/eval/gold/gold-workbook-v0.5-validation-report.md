# Gold workbook v0.5 — corpus & KG validation report

Source: Laertius Gold Annotation workbook v0.5.
Generated deterministically by `scripts/src/validate-gold-workbook.ts` (re-run to refresh).

## Check coverage (positive counts — a green run is never vacuous)

- abstain_type consistent: **25**
- authority labels resolved: **86**
- claim URLs resolved: **196**
- CTS_Map section ids resolved: **206**
- entity labels resolved: **204**
- expected_action pins matched: **4**
- KG_Edges matched: **77**
- KG_Nodes names matched: **82**
- must_abstain consistent: **200**
- passage/URN pairs agreeing: **197**
- philosopher QIDs matched: **82**
- place coordinates matched: **64**
- place Pleiades ids matched: **171**
- place QIDs matched: **64**
- qrel passages matching question: **201**
- qrels linked to questions: **239**
- question passages covered by CTS_Map: **200**
- question passages covered by qrels: **200**
- split pins matched: **3**
- urns resolved (Gold_Questions): **201**
- urns resolved (Qrels): **201**

## Discrepancies (9)

- [known] Gold_Questions false-premise-12: false-premise correction lacks a gold passage
- [known] Gold_Questions quotation-014: unknown authority "Meineke. C.G.F. iv. 618."
- [known] Gold_Questions quotation-014: unknown entity "Meineke. C.G.F. iv. 618."
- [known] Gold_Questions quotation-019: unknown authority "Il. i. 81, 82."
- [known] Gold_Questions quotation-019: unknown entity "Il. i. 81, 82."
- [known] Gold_Questions teacher-student-016: 5 gold_passages vs 6 full_cts_urn tokens
- [known] Gold_Questions teacher-student-016: passage "7.168" ≠ URN public ref "7.166"
- [known] Gold_Questions teacher-student-016: passage "7.177" ≠ URN public ref "7.168"
- [known] Gold_Questions teacher-student-016: passage "7.179" ≠ URN public ref "7.177"
