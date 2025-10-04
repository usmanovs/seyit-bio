import { Users, Video, Star } from "lucide-react";

export const SocialProofBar = () => {
  return (
    <section className="container mx-auto px-4 lg:px-8 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-3xl font-bold">10,000+</span>
            </div>
            <span className="text-sm text-muted-foreground">Happy Creators</span>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              <span className="text-3xl font-bold">15,000+</span>
            </div>
            <span className="text-sm text-muted-foreground">Videos Processed</span>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              <span className="text-3xl font-bold">4.9/5</span>
            </div>
            <span className="text-sm text-muted-foreground">User Rating</span>
          </div>
        </div>
      </div>
    </section>
  );
};
