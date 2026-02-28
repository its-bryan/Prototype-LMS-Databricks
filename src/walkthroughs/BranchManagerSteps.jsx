import TitleCard from "../components/TitleCard";
import LeadQueue from "../components/LeadQueue";
import LeadDetail from "../components/LeadDetail";
import EnrichmentForm from "../components/EnrichmentForm";
import { leads } from "../data/mockData";

function BM1() {
  return (
    <TitleCard
      title="Branch Manager — Weekly Lead Review"
      subtitle="Review cancelled and unused leads. Add context. Prepare for the weekly call."
    />
  );
}

function BM2() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1A1A1A] mb-1">My Leads</h2>
      <p className="text-sm text-[#6E6E6E] mb-4">Week of Feb 10 – Feb 21, 2026</p>
      <LeadQueue leads={leads} bannerCount={6} />
    </div>
  );
}

function BM3() {
  const lead = leads.find((l) => l.id === 1);
  return (
    <LeadDetail
      lead={lead}
      enrichmentSlot={<EnrichmentForm />}
    />
  );
}

function BM4() {
  const lead = leads.find((l) => l.id === 1);
  return (
    <LeadDetail
      lead={lead}
      enrichmentSlot={
        <EnrichmentForm
          reason="Unable to reach — no answer after multiple attempts"
          notes="Called 3x over 2 days, voicemail each time. Number may be incorrect — only 9 digits in HLES."
          animateFields
        />
      }
    />
  );
}

function BM5() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1A1A1A] mb-1">My Leads</h2>
      <p className="text-sm text-[#6E6E6E] mb-4">Week of Feb 10 – Feb 21, 2026</p>
      <LeadQueue leads={leads} enrichedIds={[1]} bannerCount={5} />
    </div>
  );
}

function BM6() {
  const lead = leads.find((l) => l.id === 2);
  return (
    <LeadDetail
      lead={lead}
      enrichmentSlot={
        <EnrichmentForm
          nextAction="Call again"
          followUpDate="Feb 22, 2026"
          notes="Customer confirmed pickup last Tuesday but never showed. Calling to reschedule."
          animateFields
        />
      }
    />
  );
}

function BM7() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1A1A1A] mb-1">My Leads</h2>
      <p className="text-sm text-[#6E6E6E] mb-4">Week of Feb 10 – Feb 21, 2026</p>
      <LeadQueue leads={leads} enrichedIds={[1, 2, 3, 5, 6, 7, 8, 9, 10, 11]} bannerCount={1} />
    </div>
  );
}

function BM8() {
  return (
    <TitleCard
      title="Every cancelled lead explained. Every unused lead has a next step."
      subtitle="Ready for the weekly call."
      summary
    />
  );
}

export const bmSteps = [BM1, BM2, BM3, BM4, BM5, BM6, BM7, BM8];
