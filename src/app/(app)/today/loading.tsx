import { Bar, ButtonShape, HeadShape, LoadingPage, RowShape, SheetShape } from "@/components/loading-shapes";

/** Hari Ini while it loads (DESIGN.md §15.5): the writing sheet, mood and energy, habits, the button. */
export default function TodayLoading() {
  return (
    <LoadingPage split>
      <div className="flex flex-col gap-2.5">
        <Bar className="h-7 w-64 max-w-full" />
        <Bar className="w-52" />
      </div>
      <div className="mt-6 flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10">
        <SheetShape>
          <div className="flex flex-col gap-3 border-b-[3px] border-double border-rule-strong pb-3">
            <Bar className="w-40" />
            <Bar className="w-52" />
          </div>
          <div className="paper-lines mt-5 min-h-[204px] md:min-h-[272px]" />
        </SheetShape>
        <div className="flex flex-col gap-6">
          {[0, 1].map((row) => (
            <div key={row} className="flex flex-col gap-4">
              <Bar className="w-44" />
              <div className="grid grid-cols-5 gap-1">
                {[0, 1, 2, 3, 4].map((item) => (
                  <span key={item} className="mx-auto size-7 rounded-full bg-surface-muted" />
                ))}
              </div>
            </div>
          ))}
          <div>
            <HeadShape />
            <RowShape lead="box" />
            <RowShape lead="box" width="w-32" />
          </div>
          <ButtonShape />
        </div>
      </div>
    </LoadingPage>
  );
}
