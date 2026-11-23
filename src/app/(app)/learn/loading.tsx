import { HeaderShape, HeadShape, LoadingPage, RowShape } from "@/components/loading-shapes";

/** Belajar while it loads (DESIGN.md §15.5): the list of materials and the reading room. */
export default function LearnLoading() {
  return (
    <LoadingPage>
      <HeaderShape />
      <div className="mt-6">
        <HeadShape />
        <RowShape width="w-44" />
        <RowShape width="w-36" />
      </div>
      <div className="mt-6">
        <HeadShape />
        <RowShape width="w-52" />
      </div>
    </LoadingPage>
  );
}
