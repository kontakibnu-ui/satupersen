import { Bar, ButtonShape, HeaderShape, HeadShape, LoadingPage, RowShape, SheetShape } from "@/components/loading-shapes";

/** Uang while it loads (DESIGN.md §15.5): the cash book, the button, the month's entries. */
export default function ExpensesLoading() {
  return (
    <LoadingPage split>
      <HeaderShape />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-x-10">
        <SheetShape className="mt-6">
          <Bar className="mx-auto w-32" />
          <Bar className="mt-5 h-3.5 w-36" />
          <Bar className="mt-2 h-9 w-52" />
          <div className="mt-5 border-t-[3px] border-double border-rule-strong">
            <RowShape width="w-full" />
            <RowShape width="w-full" />
          </div>
        </SheetShape>
        <ButtonShape className="mt-2 lg:mt-6" />
        <SheetShape className="mt-6 lg:col-start-1">
          <HeadShape />
          <RowShape lead="circle" />
          <RowShape lead="circle" width="w-28" />
        </SheetShape>
      </div>
    </LoadingPage>
  );
}
