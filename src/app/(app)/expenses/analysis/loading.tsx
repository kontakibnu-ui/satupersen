import { Bar, HeaderShape, HeadShape, LoadingPage, RowShape, SheetShape } from "@/components/loading-shapes";

/** Analisa uang while it loads (DESIGN.md §15.5, §16.2): the reading, the pace chart, the categories. */
export default function MoneyAnalysisLoading() {
  return (
    <LoadingPage>
      <HeaderShape eyebrow />
      <SheetShape className="mt-6">
        <Bar className="h-3.5 w-48" />
        <Bar className="mt-3 h-3.5 w-40" />
        <Bar className="mt-6 w-full" />
        <Bar className="mt-4 w-11/12" />
        <Bar className="mt-4 w-3/4" />
      </SheetShape>
      <div className="mt-8">
        <HeadShape />
        <Bar className="mt-4 h-52 w-full" />
      </div>
      <div className="mt-8">
        <HeadShape />
        <RowShape width="w-full" />
        <RowShape width="w-full" />
      </div>
    </LoadingPage>
  );
}
