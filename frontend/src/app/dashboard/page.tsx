// dashboard.tsx

"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import Image from "next/image";
import * as Icons from "lucide-react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import abi from "../abi";

interface ScheduleCreateRequest {
  userId: string;
  playlistUrl: string;
  scheduleType: "daily" | "target";
  dailyHours?: number;
  targetDays?: number;
  title?: string;
  completedVideos?: string[];
  lastDayNumber?: number;
  completedVideoDetails?: any[];
}

interface Schedule {
  _id: string;
  title: string;
  playlist_url: string;
  schedule_type: "daily" | "target";
  created_at: string;
  updated_at: string;
  status: "active" | "completed";
  summary: {
    totalVideos: number;
    totalDays: number;
    totalDuration: string;
    averageDailyDuration: string;
  };
  settings: {
    daily_hours?: number;
    target_days?: number;
  };
}

interface User {
  _id: string;
  fullName: string;
  email: string;
}

export default function Dashboard() {
  const contract = "0x5311cc38317DeBd3cc0e30dfd67c933a53828737";
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [scheduleType, setScheduleType] = useState<"daily" | "target">("daily");
  const [dailyHours, setDailyHours] = useState(2);
  const [targetDays, setTargetDays] = useState(7);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [monadReward, setMonadReward] = useState<string>("");

  // Deposit related states
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [username, setUsername] = useState<string>(user?.email || "");
  const [isDepositing, setIsDepositing] = useState(false);

  // Wagmi hooks for contract interaction
  const {
    writeContract,
    data: hash,
    error: writeError,
    isPending,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Read user's balance from contract
  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: contract as `0x${string}`,
    abi: abi,
    functionName: "getUsernameBalance",
    args: [username],
    query: {
      enabled: !!username,
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    // Set username to user's full name or email as default
    if (user?.fullName) {
      setUsername(user.fullName);
    }
  }, [isAuthenticated, router, user]);

  // Refetch balance when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      refetchBalance();
      setDepositAmount("");
      setIsDepositing(false);
    }
  }, [isConfirmed, refetchBalance]);

  const handleDeposit = async () => {
    if (!depositAmount || !username) {
      setError("Please enter both amount and username");
      return;
    }

    try {
      setIsDepositing(true);
      setError("");

      await writeContract({
        address: contract as `0x${string}`,
        abi: abi,
        functionName: "deposit",
        args: [username],
        value: parseEther(depositAmount),
      });
    } catch (err: any) {
      setError(err.message || "Failed to deposit");
      setIsDepositing(false);
    }
  };

  const createSchedule = async (e: React.FormEvent) => {
    handleDeposit();
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!user?._id) {
      setError("User not authenticated");
      setIsLoading(false);
      return;
    }

    try {
      const scheduleData: ScheduleCreateRequest = {
        userId: user._id,
        playlistUrl,
        scheduleType,
        title: title || "Untitled Schedule",
        ...(scheduleType === "daily" ? { dailyHours } : { targetDays }),
      };

      const response = await fetch(
        "https://learnfast-backend.onrender.com/api/schedule",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(scheduleData),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create schedule");
      }

      const data = await response.json();
      router.push(`/my-schedules`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode ? "bg-[#0B1026] text-gray-200" : "bg-[#F8FAFF] text-gray-800"
      }`}
    >
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold">
              <span className="text-indigo-500">Learn</span>Fast
            </span>
          </div>
          <div className="flex items-center space-x-6">
            <button
              onClick={() => router.push("/my-schedules")}
              className="p-2 hover:bg-gray-700/50 rounded-full"
            >
              <Icons.ListTodo size={20} />
            </button>
            <appkit-button />

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-gray-700/50 rounded-full"
            >
              {isDarkMode ? <Icons.Sun size={20} /> : <Icons.Moon size={20} />}
            </button>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Icons.User className="text-gray-400" size={20} />
                <span className="font-medium">{user?.fullName}</span>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <Icons.LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">
            Create New Learning Schedule
          </h1>

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
              <Icons.AlertCircle className="inline-block mr-2" size={20} />
              {error}
            </div>
          )}

          <form onSubmit={createSchedule} className="space-y-6">
            <div>
              <label className="block mb-2 text-sm font-medium">
                Schedule Title (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your schedule"
                className={`w-full p-3 rounded-lg ${
                  isDarkMode
                    ? "bg-gray-800/50 border-gray-700"
                    : "bg-white border-gray-300"
                } border`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">
                YouTube Playlist URL
              </label>
              <input
                type="text"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="Enter YouTube playlist URL"
                required
                className={`w-full p-3 rounded-lg ${
                  isDarkMode
                    ? "bg-gray-800/50 border-gray-700"
                    : "bg-white border-gray-300"
                } border`}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium">
                Schedule Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setScheduleType("daily")}
                  className={`p-4 rounded-lg border ${
                    scheduleType === "daily"
                      ? "border-indigo-500 bg-indigo-500/10"
                      : isDarkMode
                      ? "border-gray-700 bg-gray-800/50"
                      : "border-gray-300 bg-gray-100"
                  }`}
                >
                  <Icons.Clock className="mx-auto mb-2" size={24} />
                  <div className="font-medium">Daily Hours</div>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType("target")}
                  className={`p-4 rounded-lg border ${
                    scheduleType === "target"
                      ? "border-indigo-500 bg-indigo-500/10"
                      : isDarkMode
                      ? "border-gray-700 bg-gray-800/50"
                      : "border-gray-300 bg-gray-100"
                  }`}
                >
                  <Icons.Calendar className="mx-auto mb-2" size={24} />
                  <div className="font-medium">Target Days</div>
                </button>
              </div>
            </div>

            {scheduleType === "daily" ? (
              <div>
                <label className="block mb-2 text-sm font-medium">
                  Daily Study Hours
                </label>
                <input
                  type="number"
                  value={dailyHours}
                  onChange={(e) => setDailyHours(Number(e.target.value))}
                  min="0.5"
                  max="24"
                  step="0.5"
                  required
                  className={`w-full p-3 rounded-lg ${
                    isDarkMode
                      ? "bg-gray-800/50 border-gray-700"
                      : "bg-white border-gray-300"
                  } border`}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Set how many hours you can dedicate to learning each day
                </p>
              </div>
            ) : (
              <div>
                <label className="block mb-2 text-sm font-medium">
                  Target Days
                </label>
                <input
                  type="number"
                  value={targetDays}
                  onChange={(e) => setTargetDays(Number(e.target.value))}
                  min="1"
                  max="365"
                  required
                  className={`w-full p-3 rounded-lg ${
                    isDarkMode
                      ? "bg-gray-800/50 border-gray-700"
                      : "bg-white border-gray-300"
                  } border`}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Set the number of days you want to complete this playlist in
                </p>
              </div>
            )}

            <div>
              <label className="block mb-2 text-sm font-medium">
                Reward Amount (ETH)
              </label>
              <input
                type="number"
                value={monadReward}
                onChange={(e) => setMonadReward(e.target.value)}
                placeholder="0.01"
                step="0.01"
                min="0"
                className={`w-full p-3 rounded-lg ${
                  isDarkMode
                    ? "bg-gray-800/50 border-gray-700"
                    : "bg-white border-gray-300"
                } border`}
              />
              <p className="mt-2 text-sm text-gray-500">
                Set the reward amount you'll receive upon completion
              </p>
            </div>
            {/* Deposit Section */}
            <div
              className={`mb-8 p-6 rounded-xl ${
                isDarkMode ? "bg-gray-900/50" : "bg-white/70"
              }`}
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Icons.Wallet className="mr-2 text-indigo-500" size={20} />
                Deposit Reward
              </h2>

              {userBalance !== undefined && (
                <div className="mb-4 p-3 bg-indigo-500/10 rounded-lg">
                  <span className="text-sm text-indigo-400">
                    Current Balance:{" "}
                  </span>
                  <span className="font-medium">
                    {formatEther(userBalance as bigint)} ETH
                  </span>
                </div>
              )}

              <div className="gap-4 mb-4">
                <div>
                  <label className="block mb-2 text-sm font-medium">
                    Amount (ETH)
                  </label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.01"
                    step="0.01"
                    min="0"
                    className={`w-full p-3 rounded-lg ${
                      isDarkMode
                        ? "bg-gray-800/50 border-gray-700"
                        : "bg-white border-gray-300"
                    } border`}
                  />
                </div>
              </div>

              {hash && (
                <div className="mt-4 p-3 bg-blue-500/10 rounded-lg">
                  <span className="text-sm text-blue-400">
                    Transaction Hash:{" "}
                  </span>
                  <span className="font-mono text-xs break-all">{hash}</span>
                </div>
              )}

              {isConfirmed && (
                <div className="mt-4 p-3 bg-green-500/10 rounded-lg text-green-400">
                  <Icons.CheckCircle className="inline-block mr-2" size={16} />
                  Deposit successful!
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Icons.Loader2 className="animate-spin mr-2" size={20} />
                  <span>Creating Schedule...</span>
                </div>
              ) : (
                "Create Schedule"
              )}
            </button>
          </form>

          {/* Features Section */}
          <div className="mt-12 pt-8 border-t border-gray-800">
            <h2 className="text-xl font-semibold mb-6">Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                className={`p-6 rounded-xl ${
                  isDarkMode ? "bg-gray-900/50" : "bg-white/70"
                }`}
              >
                <Icons.Clock className="mb-4 text-indigo-500" size={24} />
                <h3 className="font-medium mb-2">Smart Time Distribution</h3>
                <p className="text-sm text-gray-500">
                  Automatically distributes videos across your schedule based on
                  your available time
                </p>
              </div>
              <div
                className={`p-6 rounded-xl ${
                  isDarkMode ? "bg-gray-900/50" : "bg-white/70"
                }`}
              >
                <Icons.Calendar className="mb-4 text-indigo-500" size={24} />
                <h3 className="font-medium mb-2">Flexible Planning</h3>
                <p className="text-sm text-gray-500">
                  Choose between daily hours or target days to match your
                  learning style
                </p>
              </div>
              <div
                className={`p-6 rounded-xl ${
                  isDarkMode ? "bg-gray-900/50" : "bg-white/70"
                }`}
              >
                <Icons.BarChart2 className="mb-4 text-indigo-500" size={24} />
                <h3 className="font-medium mb-2">Progress Tracking</h3>
                <p className="text-sm text-gray-500">
                  Track your learning progress and stay motivated
                </p>
              </div>
              <div
                className={`p-6 rounded-xl ${
                  isDarkMode ? "bg-gray-900/50" : "bg-white/70"
                }`}
              >
                <Icons.Coins className="mb-4 text-indigo-500" size={24} />
                <h3 className="font-medium mb-2">Crypto Rewards</h3>
                <p className="text-sm text-gray-500">
                  Deposit ETH as rewards and get them back when you complete
                  your schedule
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
