import recruiterChecks from "@/assets/recruiter-checks.svg"
import beatAts from "@/assets/beat-ats.svg"
import getFeedback from "@/assets/get-feedback.svg"
import resumeScore from "@/assets/resume-score.svg"

const features = [
  {
    icon: recruiterChecks,
    title: "20+ Recruiter Checks",
    description: "Find out if your resume passes 20+ key recruiter checks.",
  },
  {
    icon: resumeScore,
    title: "Resume Score",
    description: "Get a resume score out of 100, with a list of improvements.",
  },
  {
    icon: beatAts,
    title: "ATS Analysis",
    description: "Make sure your resume gets past the automated resume screeners.",
  },
  {
    icon: getFeedback,
    title: "Detailed Feedback",
    description: "Get feedback on each section and line on your resume.",
  },
]

/** 「简历分析包含什么」特性介绍区块（暂未接入任何页面） */
export default function ResumeReviewFeatures() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12">
      <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
        Here's what to expect from your <br className="hidden sm:block" />
        free resume review.
      </h2>
      <div className="mt-10 grid gap-10 sm:grid-cols-2">
        {features.map((feature) => (
          <div key={feature.title} className="flex items-start gap-5">
            <div className="flex size-24 shrink-0 items-center justify-center rounded-2xl bg-primary/5">
              <img src={feature.icon} alt="" className="size-16 object-contain" />
            </div>
            <div>
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
