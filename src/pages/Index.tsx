import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, Linkedin, Youtube, FileText } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Seyitbek Usmanov
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground">
            Salesforce Expert • Researcher • Educator • Content Creator
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Sharing inspirational ideas about Salesforce, real estate, and personal finance 
            to help you 10x your life.
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            <Button asChild>
              <a href="https://sfchef.substack.com/" target="_blank" rel="noopener noreferrer">
                <FileText className="mr-2 h-4 w-4" />
                Read My Newsletter
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://www.youtube.com/c/SalesforceChief" target="_blank" rel="noopener noreferrer">
                <Youtube className="mr-2 h-4 w-4" />
                YouTube Channel
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">What I Do</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-xl font-semibold">Content Creation</h3>
              <p className="text-muted-foreground">
                Creator of "Profit with Salesforce" on Substack with over 1,000 subscribers. 
                Running the Salesforce Chef YouTube channel, sharing insights and tutorials.
              </p>
            </Card>
            
            <Card className="p-6 space-y-4">
              <h3 className="text-xl font-semibold">Research & Academia</h3>
              <p className="text-muted-foreground">
                Head of Research at the Central Asian Free Market Institute. 
                Professor at Montgomery College in Career Development.
              </p>
            </Card>
            
            <Card className="p-6 space-y-4">
              <h3 className="text-xl font-semibold">Salesforce Expertise</h3>
              <p className="text-muted-foreground">
                Helping professionals master Salesforce and accelerate their careers 
                through practical insights and real-world strategies.
              </p>
            </Card>
            
            <Card className="p-6 space-y-4">
              <h3 className="text-xl font-semibold">Advisory & Consulting</h3>
              <p className="text-muted-foreground">
                Senior Research Associate at CognoLink Limited. 
                Advisory Board member at Lifeboat Foundation.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Connect Section */}
      <section className="container mx-auto px-4 py-16 pb-20">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold">Let's Connect</h2>
          <p className="text-muted-foreground">
            Interested in Salesforce, research collaboration, or content creation? Reach out!
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            <Button variant="outline" size="lg" asChild>
              <a href="https://www.linkedin.com/in/seyitbek" target="_blank" rel="noopener noreferrer">
                <Linkedin className="mr-2 h-5 w-5" />
                LinkedIn
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="mailto:contact@seyitbek.com">
                <Mail className="mr-2 h-5 w-5" />
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
