import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Айжан Касымова",
    role: "Content Creator",
    avatar: "АК",
    quote: "This tool saved me 20 hours a week! My Kyrgyz audience loves the professional subtitles, and I can finally keep up with my content schedule.",
    rating: 5
  },
  {
    name: "Бакыт Токтошев",
    role: "Marketing Manager",
    avatar: "БТ",
    quote: "We reached 300% more engagement after adding Kyrgyz subtitles. The AI accuracy is incredible - better than our previous freelancers!",
    rating: 5
  },
  {
    name: "Гульнара Ибраимова",
    role: "YouTube Creator",
    avatar: "ГИ",
    quote: "From upload to download in 5 minutes. This is exactly what I needed. The styling options are beautiful and my subscribers keep asking how I do it!",
    rating: 5
  }
];

export const Testimonials = () => {
  return (
    <section className="container mx-auto px-4 lg:px-8 py-16 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Loved by Creators
          </h2>
          <p className="text-xl text-muted-foreground font-light">
            Join thousands of satisfied content creators
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-border/40 bg-card hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="flex gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                
                <p className="text-muted-foreground leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
                
                <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                  <Avatar>
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                      {testimonial.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
