import { Zap, Target, Sparkles, DollarSign, FileVideo, Edit3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const benefits = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "From 8 hours to 8 minutes. Generate professional subtitles in minutes, not days."
  },
  {
    icon: Target,
    title: "99% Accuracy",
    description: "AI-powered precision ensures perfect timing and translation every time."
  },
  {
    icon: Sparkles,
    title: "Professional Styling",
    description: "Choose from beautiful subtitle styles that match your brand perfectly."
  },
  {
    icon: DollarSign,
    title: "Save Thousands",
    description: "Stop paying expensive freelancers. Generate unlimited subtitles for less."
  },
  {
    icon: FileVideo,
    title: "All Formats",
    description: "Support for MP4, MOV, AVI, and more. Works with any video format."
  },
  {
    icon: Edit3,
    title: "Easy Editing",
    description: "Fine-tune subtitles with our intuitive editor. Perfect control at your fingertips."
  }
];

export const BenefitsGrid = () => {
  return (
    <section className="container mx-auto px-4 lg:px-8 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Why Choose Kyrgyz Subtitle Pro?
          </h2>
          <p className="text-xl text-muted-foreground font-light max-w-2xl mx-auto">
            Everything you need to create professional subtitles that captivate your audience
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <Card key={index} className="border-border/40 bg-card/50 backdrop-blur hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold">{benefit.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
