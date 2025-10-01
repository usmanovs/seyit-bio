import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Newspaper, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NewsItem {
  title: string;
  summary: string;
}

export const DailyNews = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-daily-news');

      if (error) throw error;

      setNews(data.news || []);
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
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="w-5 h-5" />
            Today's Top News (Powered by Gemini)
          </CardTitle>
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
            {news.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No news available at the moment
              </p>
            ) : (
              news.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-background rounded-lg border hover:border-primary/50 transition-colors"
                >
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.summary}</p>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
