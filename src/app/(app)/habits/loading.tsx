import { HeaderShape, HeadShape, LoadingPage, RowShape, SheetShape } from "@/components/loading-shapes";

/** Kebiasaan while it loads (DESIGN.md §15.5): today's checklist on its sheet. */
export default function HabitsLoading() {
  return (
    <LoadingPage>
      <HeaderShape eyebrow />
      <SheetShape className="mt-6">
        <HeadShape />
        <RowShape lead="box" />
        <RowShape lead="box" width="w-32" />
        <RowShape lead="box" width="w-48" />
      </SheetShape>
    </LoadingPage>
  );
}
