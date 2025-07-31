import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCalendar } from '@/hooks/useCalendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Plus, Clock, Heart, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SharedCalendarProps {
  partnerId?: string;
}

export const SharedCalendar: React.FC<SharedCalendarProps> = ({ partnerId }) => {
  const { events, loading, createEvent } = useCalendar(partnerId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: ''
  });

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.start_time || !formData.end_time) return;

    const result = await createEvent({
      title: formData.title,
      description: formData.description,
      start_time: formData.start_time,
      end_time: formData.end_time,
      partner_id: partnerId
    });

    if (result) {
      setFormData({ title: '', description: '', start_time: '', end_time: '' });
      setIsDialogOpen(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events.filter(event => new Date(event.start_time) > now);
  };

  const getPastEvents = () => {
    const now = new Date();
    return events.filter(event => new Date(event.start_time) <= now);
  };

  return (
    <Card className="border-pink-200 dark:border-pink-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-pink-500" />
            Shared Calendar
          </CardTitle>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-pink-500 to-purple-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Date
              </Button>
            </DialogTrigger>
            
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Plan a Watch Date</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <Input
                  placeholder="Movie night, series marathon..."
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
                
                <Textarea
                  placeholder="Add details about what you'll watch..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Start Time</label>
                    <Input
                      type="datetime-local"
                      value={formData.start_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">End Time</label>
                    <Input
                      type="datetime-local"
                      value={formData.end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <Button type="submit" className="w-full">
                  Create Watch Date
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Upcoming Events */}
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" />
                Upcoming Dates
              </h3>
              
              <AnimatePresence>
                {getUpcomingEvents().length > 0 ? (
                  <div className="space-y-3">
                    {getUpcomingEvents().map((event, index) => {
                      const { date, time } = formatDate(event.start_time);
                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: index * 0.1 }}
                          className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-lg border border-pink-200 dark:border-pink-800"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h4 className="font-medium">{event.title}</h4>
                              {event.description && (
                                <p className="text-sm text-muted-foreground">{event.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {date}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {time}
                                </span>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-pink-100 dark:bg-pink-900">
                              Upcoming
                            </Badge>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No upcoming dates planned</p>
                    <p className="text-sm">Create your first watch date together!</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Past Events */}
            {getPastEvents().length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-500" />
                  Past Dates
                </h3>
                
                <div className="space-y-2">
                  {getPastEvents().slice(0, 3).map((event) => {
                    const { date, time } = formatDate(event.start_time);
                    return (
                      <div
                        key={event.id}
                        className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-sm">{event.title}</h4>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{date}</span>
                              <span>•</span>
                              <span>{time}</span>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            Completed
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};