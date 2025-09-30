import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, Linkedin, Youtube, FileText } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight font-righteous animate-fade-in">
            Seyitbek Usmanov
          </h1>
          <div className="inline-block bg-gradient-to-r from-primary via-purple-500 to-secondary text-white px-8 py-3 transform -rotate-1 shadow-retro-lg animate-scale-in">
            <p className="text-xl md:text-2xl font-bold">
              Salesforce Expert • Researcher • Educator
            </p>
          </div>
          <p className="text-lg md:text-xl text-foreground max-w-2xl mx-auto font-semibold">
            Sharing inspirational ideas about Salesforce, real estate, and personal finance 
            to help you 10x your life 💪
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            <Button 
              asChild 
              className="shadow-retro border-4 border-foreground hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all font-bold text-lg"
            >
              <a href="https://sfchef.substack.com/" target="_blank" rel="noopener noreferrer">
                <FileText className="mr-2 h-5 w-5" />
                Read My Newsletter
              </a>
            </Button>
            <Button 
              asChild
              className="bg-secondary shadow-retro border-4 border-foreground hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all font-bold text-lg"
            >
              <a href="https://www.youtube.com/c/SalesforceChief" target="_blank" rel="noopener noreferrer">
                <Youtube className="mr-2 h-5 w-5" />
                YouTube
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold mb-12 text-center font-righteous">What I Do</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4 border-4 border-foreground shadow-retro hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all bg-accent">
              <h3 className="text-2xl font-bold font-righteous">Content Creation</h3>
              <p className="text-foreground font-semibold">
                Creator of "Profit with Salesforce" on Substack with over 1,000 subscribers. 
                Running the Salesforce Chef YouTube channel, sharing insights and tutorials.
              </p>
            </Card>
            
            <Card className="p-6 space-y-4 border-4 border-foreground shadow-retro hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all bg-secondary text-secondary-foreground">
              <h3 className="text-2xl font-bold font-righteous">Research & Academia</h3>
              <p className="font-semibold">
                Head of Research at the Central Asian Free Market Institute. 
                Professor at Montgomery College in Career Development.
              </p>
            </Card>
            
            <Card className="p-6 space-y-4 border-4 border-foreground shadow-retro hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all bg-primary text-primary-foreground">
              <h3 className="text-2xl font-bold font-righteous">Salesforce Expertise</h3>
              <p className="font-semibold">
                Helping professionals master Salesforce and accelerate their careers 
                through practical insights and real-world strategies.
              </p>
            </Card>
            
            <Card className="p-6 space-y-4 border-4 border-foreground shadow-retro hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all bg-card">
              <h3 className="text-2xl font-bold font-righteous">Advisory & Consulting</h3>
              <p className="text-card-foreground font-semibold">
                Senior Research Associate at CognoLink Limited. 
                Advisory Board member at Lifeboat Foundation.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Connect Section */}
      <section className="container mx-auto px-4 py-16 pb-20">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="inline-block">
            <h2 className="text-4xl md:text-5xl font-bold font-righteous bg-accent px-8 py-4 border-4 border-foreground shadow-retro-lg transform rotate-1">
              Let's Connect
            </h2>
          </div>
          <p className="text-lg text-foreground font-semibold">
            Interested in Salesforce, research collaboration, or content creation? Reach out!
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              asChild
              className="shadow-retro border-4 border-foreground hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all font-bold text-lg"
            >
              <a href="https://www.linkedin.com/in/seyitbek" target="_blank" rel="noopener noreferrer">
                <Linkedin className="mr-2 h-6 w-6" />
                LinkedIn
              </a>
            </Button>
            <Button 
              size="lg" 
              asChild
              className="bg-accent text-accent-foreground shadow-retro border-4 border-foreground hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all font-bold text-lg"
            >
              <a href="mailto:contact@seyitbek.com">
                <Mail className="mr-2 h-6 w-6" />
                Email
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
