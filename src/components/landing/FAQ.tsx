import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How accurate are the AI-generated subtitles?",
    answer: "Our AI achieves 99% accuracy for clear audio. It uses advanced speech recognition and translation models specifically trained for Kyrgyz language, ensuring professional-quality results."
  },
  {
    question: "What video formats do you support?",
    answer: "We support all major video formats including MP4, MOV, AVI, MKV, and more. Maximum file size is 2GB for free users and 10GB for Pro users."
  },
  {
    question: "Can I edit the subtitles after generation?",
    answer: "Absolutely! Our built-in editor lets you adjust text, timing, and styling. Make any changes you need before downloading your final video."
  },
  {
    question: "How long does processing take?",
    answer: "Most videos are processed in 5-10 minutes. Pro users get priority processing with typical turnaround times of 2-5 minutes."
  },
  {
    question: "Is there a free trial?",
    answer: "Yes! All new users get a 24-hour free trial of Pro features. No credit card required. After that, you can continue with our free plan or upgrade to Pro."
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: "Yes, you can cancel anytime with no penalties. You'll continue to have access to Pro features until the end of your billing period."
  },
  {
    question: "Do you store my videos?",
    answer: "Your videos are temporarily stored during processing and automatically deleted after 24 hours. We take your privacy seriously and never share your content."
  },
  {
    question: "What languages do you support besides Kyrgyz?",
    answer: "Currently, we specialize in Kyrgyz subtitle generation from any source language. We're working on adding more target languages based on user demand."
  }
];

export const FAQ = () => {
  return (
    <section className="container mx-auto px-4 lg:px-8 py-16 bg-muted/30">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-muted-foreground font-light">
            Everything you need to know
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="border border-border/40 rounded-lg px-6 bg-card"
            >
              <AccordionTrigger className="text-left hover:no-underline py-4">
                <span className="font-semibold pr-4">{faq.question}</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
