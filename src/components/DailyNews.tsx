import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Newspaper, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NewsItem {
  title: string;
  summary: string;
  imageUrl?: string;
}

export const DailyNews = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingImages, setGeneratingImages] = useState(false);

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const generateImages = async (newsItems: NewsItem[]) => {
    setGeneratingImages(true);
    const newsWithImages = await Promise.all(
      newsItems.map(async (item) => {
        try {
          const { data, error } = await supabase.functions.invoke('generate-news-image', {
            body: { newsTitle: item.title }
          });
          
          if (error) throw error;
          
          return { ...item, imageUrl: data.imageUrl };
        } catch (error) {
          console.error('Failed to generate image for:', item.title, error);
          return item;
        }
      })
    );
    setNews(newsWithImages);
    setGeneratingImages(false);
  };

  const fetchNews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-daily-news');

      if (error) throw error;

      const newsItems = data.news || [];
      setNews(newsItems);
      
      // Generate images after getting news
      if (newsItems.length > 0) {
        generateImages(newsItems);
      }
    } catch (error: any) {
      console.error("News fetch error:", error);
      toast.error("Failed to fetch daily news");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <Card className="w-full bg-gradient-to-r from-primary/5 to-accent/5 border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Newspaper className="w-5 h-5" />
              Top 3 AI News
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{todayDate}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchNews}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {generatingImages && (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating images...
                </p>
              </div>
            )}
            {news.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No news available at the moment
              </p>
            ) : (
              news.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-background rounded-lg border hover:border-primary/50 transition-colors flex gap-4"
                >
                  {item.imageUrl && (
                    <div className="flex-shrink-0 rounded-md overflow-hidden w-24 h-24">
                      <img 
                        src={item.imageUrl} 
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.summary}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
