import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/utils/trpc";
import { useToast } from "@/components/ui/toast";

interface SystemSound {
  name: string;
  path: string;
  durationMicroseconds: number;
}

export function SystemSoundsTable() {
  const [sounds, setSounds] = useState<SystemSound[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [detectedOS, setDetectedOS] = useState<"mac" | "windows" | "other">("other");
  const toast = useToast();

  // Detect OS on mount
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const platform = navigator.platform.toLowerCase();
      const userAgent = navigator.userAgent.toLowerCase();

      if (platform.includes("mac") || userAgent.includes("macintosh")) {
        setDetectedOS("mac");
      } else if (platform.includes("win") || userAgent.includes("windows")) {
        setDetectedOS("windows");
      } else {
        setDetectedOS("other");
      }
    }
  }, []);

  const listQuery = trpc.systemSounds.list.useQuery();
  const playMutation = trpc.systemSounds.play.useMutation();

  useEffect(() => {
    if (listQuery.data !== undefined) {
      setSounds(listQuery.data);
      setLoading(false);
    }
  }, [listQuery.data]);

  const formatDuration = (microseconds: number): string => {
    const seconds = microseconds / 1_000_000;
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);

    if (minutes > 0) {
      return `${minutes}:${parseInt(secs).toString().padStart(2, "0")}`;
    }
    return `${secs}s`;
  };

  const handlePlay = async (sound: SystemSound) => {
    setPlaying(sound.path);
    try {
      await playMutation.mutateAsync({ soundPath: sound.path });
      toast.addToast(`Playing: ${sound.name}`, "success", 2000);
    } catch (error) {
      toast.addToast("Failed to play sound", "error");
      console.error(error);
    } finally {
      setPlaying(null);
    }
  };

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading system sounds...</div>;
  }

  // Show message for unsupported systems
  if (detectedOS === "other") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Sounds</CardTitle>
          <CardDescription>
            This feature is available on macOS and Windows
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-950/40 border border-blue-700 rounded-lg p-4 text-sm">
            <p className="text-foreground mb-2">
              <strong>Platform Not Supported:</strong> System sounds are currently available on macOS and Windows only.
            </p>
            <p className="text-muted-foreground text-xs">
              You're currently on <strong>{
                typeof navigator !== "undefined"
                  ? navigator.platform || "an unknown platform"
                  : "an unknown platform"
              }</strong>.
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Platform Support:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>✅ macOS - Full support with sound browsing and playback</li>
              <li>✅ Windows - Full support with sound browsing and playback</li>
              <li>⏳ Linux - Coming soon</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sounds.length === 0) {
    const platformName = detectedOS === "mac" ? "macOS" : "Windows";
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Sounds</CardTitle>
          <CardDescription>
            No system sounds found on this {platformName} system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {detectedOS === "mac"
              ? "System sounds are typically stored in /System/Library/Sounds and ~/Library/Sounds."
              : "System sounds are typically stored in C:\\Windows\\Media."}
            If no sounds are found, please check that these directories exist on your system.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Sounds ({sounds.length})</CardTitle>
        <CardDescription>
          Browse and preview system sounds available on your {detectedOS === "mac" ? "macOS" : "Windows"} system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* System Sounds Table */}
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-4 py-2 text-left font-semibold">Sound Name</th>
                  <th className="px-4 py-2 text-right font-semibold">Duration</th>
                  <th className="px-4 py-2 text-right font-semibold">Microseconds</th>
                  <th className="px-4 py-2 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {sounds.map((sound) => (
                  <tr
                    key={sound.path}
                    className="border-b border-border hover:bg-secondary/30 transition-colors"
                  >
                    {/* Sound Name */}
                    <td className="px-4 py-2 font-mono text-xs">{sound.name}</td>

                    {/* Duration */}
                    <td className="px-4 py-2 text-right text-xs">
                      {formatDuration(sound.durationMicroseconds)}
                    </td>

                    {/* Microseconds */}
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {sound.durationMicroseconds.toLocaleString()}μs
                    </td>

                    {/* Play Button */}
                    <td className="px-4 py-2 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePlay(sound)}
                        disabled={playing === sound.path}
                        className="text-xs h-7 px-2"
                        title="Play this system sound"
                      >
                        {playing === sound.path ? "▶ Playing..." : "▶ Play"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Info Text */}
          <div className="text-xs text-muted-foreground bg-secondary/30 rounded p-3">
            💡 <strong>Tip:</strong> Click "Play" to preview each system sound. The duration is shown in both
            human-readable format (MM:SS) and microseconds for precise timing.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
