"use client";

import { Sun, MapPin, Thermometer, Droplets, Wind } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { weatherData } from "@/components/dashboard/config";

// Weather Widget (demo data)
export function WeatherWidget() {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-400">Demo data</Badge>
      </div>
      {/* Current Weather */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-gradient-to-br from-amber-400 to-orange-500 p-2">
            <Sun className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold">{weatherData.temp}°</p>
            <p className="text-xs text-muted-foreground">{weatherData.condition}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {weatherData.location}
          </div>
        </div>
      </div>

      {/* Weather Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/50 p-1.5 text-center">
          <Thermometer className="mx-auto h-3 w-3 text-amber-400 mb-0.5" />
          <p className="text-xs font-medium">{weatherData.high}°/{weatherData.low}°</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-1.5 text-center">
          <Droplets className="mx-auto h-3 w-3 text-blue-400 mb-0.5" />
          <p className="text-xs font-medium">{weatherData.humidity}%</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-1.5 text-center">
          <Wind className="mx-auto h-3 w-3 text-cyan-400 mb-0.5" />
          <p className="text-xs font-medium">{weatherData.wind}mph</p>
        </div>
      </div>

      {/* 5-Day Forecast */}
      <div>
        <p className="text-[10px] font-medium text-muted-foreground mb-1">5-Day Forecast</p>
        <div className="flex justify-between gap-1">
          {weatherData.forecast.map((day) => (
            <div key={day.day} className="flex flex-col items-center rounded-md bg-muted/30 px-1.5 py-1 flex-1">
              <p className="text-[10px] font-medium">{day.day}</p>
              <day.icon className="my-0.5 h-3 w-3 text-amber-400" />
              <p className="text-[10px]">{day.temp}°</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
