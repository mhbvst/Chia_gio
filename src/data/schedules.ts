export type MachineKey = string;

export interface ScheduleRow {
  stt: number;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
}

export interface MachineConfig {
  key: MachineKey;
  id: string;
  name: string;
  fullTitle: string;
  supervisor: string;
  totalRows: number;
  defaultTheme: 'light' | 'dark' | 'green' | 'purple';
  rows: ScheduleRow[];
}

export const TITAN2000_ROWS: ScheduleRow[] = [
  {
    "stt": 1,
    "morningStart": "07:30",
    "morningEnd": "07:36",
    "afternoonStart": "13:00",
    "afternoonEnd": "13:06"
  },
  {
    "stt": 2,
    "morningStart": "07:32",
    "morningEnd": "07:38",
    "afternoonStart": "13:02",
    "afternoonEnd": "13:08"
  },
  {
    "stt": 3,
    "morningStart": "07:34",
    "morningEnd": "07:40",
    "afternoonStart": "13:04",
    "afternoonEnd": "13:10"
  },
  {
    "stt": 4,
    "morningStart": "07:37",
    "morningEnd": "07:43",
    "afternoonStart": "13:07",
    "afternoonEnd": "13:13"
  },
  {
    "stt": 5,
    "morningStart": "07:39",
    "morningEnd": "07:45",
    "afternoonStart": "13:09",
    "afternoonEnd": "13:15"
  },
  {
    "stt": 6,
    "morningStart": "07:41",
    "morningEnd": "07:47",
    "afternoonStart": "13:11",
    "afternoonEnd": "13:17"
  },
  {
    "stt": 7,
    "morningStart": "07:44",
    "morningEnd": "07:50",
    "afternoonStart": "13:14",
    "afternoonEnd": "13:20"
  },
  {
    "stt": 8,
    "morningStart": "07:46",
    "morningEnd": "07:52",
    "afternoonStart": "13:16",
    "afternoonEnd": "13:22"
  },
  {
    "stt": 9,
    "morningStart": "07:48",
    "morningEnd": "07:54",
    "afternoonStart": "13:18",
    "afternoonEnd": "13:24"
  },
  {
    "stt": 10,
    "morningStart": "07:51",
    "morningEnd": "07:57",
    "afternoonStart": "13:21",
    "afternoonEnd": "13:27"
  },
  {
    "stt": 11,
    "morningStart": "07:53",
    "morningEnd": "07:59",
    "afternoonStart": "13:23",
    "afternoonEnd": "13:29"
  },
  {
    "stt": 12,
    "morningStart": "07:55",
    "morningEnd": "08:01",
    "afternoonStart": "13:25",
    "afternoonEnd": "13:31"
  },
  {
    "stt": 13,
    "morningStart": "07:58",
    "morningEnd": "08:04",
    "afternoonStart": "13:28",
    "afternoonEnd": "13:34"
  },
  {
    "stt": 14,
    "morningStart": "08:00",
    "morningEnd": "08:06",
    "afternoonStart": "13:30",
    "afternoonEnd": "13:36"
  },
  {
    "stt": 15,
    "morningStart": "08:02",
    "morningEnd": "08:08",
    "afternoonStart": "13:32",
    "afternoonEnd": "13:38"
  },
  {
    "stt": 16,
    "morningStart": "08:05",
    "morningEnd": "08:11",
    "afternoonStart": "13:35",
    "afternoonEnd": "13:41"
  },
  {
    "stt": 17,
    "morningStart": "08:07",
    "morningEnd": "08:13",
    "afternoonStart": "13:37",
    "afternoonEnd": "13:43"
  },
  {
    "stt": 18,
    "morningStart": "08:09",
    "morningEnd": "08:15",
    "afternoonStart": "13:39",
    "afternoonEnd": "13:45"
  },
  {
    "stt": 19,
    "morningStart": "08:12",
    "morningEnd": "08:18",
    "afternoonStart": "13:42",
    "afternoonEnd": "13:48"
  },
  {
    "stt": 20,
    "morningStart": "08:14",
    "morningEnd": "08:20",
    "afternoonStart": "13:44",
    "afternoonEnd": "13:50"
  },
  {
    "stt": 21,
    "morningStart": "08:16",
    "morningEnd": "08:22",
    "afternoonStart": "13:46",
    "afternoonEnd": "13:52"
  },
  {
    "stt": 22,
    "morningStart": "08:19",
    "morningEnd": "08:25",
    "afternoonStart": "13:49",
    "afternoonEnd": "13:55"
  },
  {
    "stt": 23,
    "morningStart": "08:21",
    "morningEnd": "08:27",
    "afternoonStart": "13:51",
    "afternoonEnd": "13:57"
  },
  {
    "stt": 24,
    "morningStart": "08:23",
    "morningEnd": "08:29",
    "afternoonStart": "13:53",
    "afternoonEnd": "13:59"
  },
  {
    "stt": 25,
    "morningStart": "08:26",
    "morningEnd": "08:32",
    "afternoonStart": "13:56",
    "afternoonEnd": "14:02"
  },
  {
    "stt": 26,
    "morningStart": "08:28",
    "morningEnd": "08:34",
    "afternoonStart": "13:58",
    "afternoonEnd": "14:04"
  },
  {
    "stt": 27,
    "morningStart": "08:30",
    "morningEnd": "08:36",
    "afternoonStart": "14:00",
    "afternoonEnd": "14:06"
  },
  {
    "stt": 28,
    "morningStart": "08:33",
    "morningEnd": "08:39",
    "afternoonStart": "14:03",
    "afternoonEnd": "14:09"
  },
  {
    "stt": 29,
    "morningStart": "08:35",
    "morningEnd": "08:41",
    "afternoonStart": "14:05",
    "afternoonEnd": "14:11"
  },
  {
    "stt": 30,
    "morningStart": "08:37",
    "morningEnd": "08:43",
    "afternoonStart": "14:07",
    "afternoonEnd": "14:13"
  },
  {
    "stt": 31,
    "morningStart": "08:40",
    "morningEnd": "08:46",
    "afternoonStart": "14:10",
    "afternoonEnd": "14:16"
  },
  {
    "stt": 32,
    "morningStart": "08:42",
    "morningEnd": "08:48",
    "afternoonStart": "14:12",
    "afternoonEnd": "14:18"
  },
  {
    "stt": 33,
    "morningStart": "08:44",
    "morningEnd": "08:50",
    "afternoonStart": "14:14",
    "afternoonEnd": "14:20"
  },
  {
    "stt": 34,
    "morningStart": "08:47",
    "morningEnd": "08:53",
    "afternoonStart": "14:17",
    "afternoonEnd": "14:23"
  },
  {
    "stt": 35,
    "morningStart": "08:49",
    "morningEnd": "08:55",
    "afternoonStart": "14:19",
    "afternoonEnd": "14:25"
  },
  {
    "stt": 36,
    "morningStart": "08:51",
    "morningEnd": "08:57",
    "afternoonStart": "14:21",
    "afternoonEnd": "14:27"
  },
  {
    "stt": 37,
    "morningStart": "08:54",
    "morningEnd": "09:00",
    "afternoonStart": "14:24",
    "afternoonEnd": "14:30"
  },
  {
    "stt": 38,
    "morningStart": "08:56",
    "morningEnd": "09:02",
    "afternoonStart": "14:26",
    "afternoonEnd": "14:32"
  },
  {
    "stt": 39,
    "morningStart": "08:58",
    "morningEnd": "09:04",
    "afternoonStart": "14:28",
    "afternoonEnd": "14:34"
  },
  {
    "stt": 40,
    "morningStart": "09:01",
    "morningEnd": "09:07",
    "afternoonStart": "14:31",
    "afternoonEnd": "14:37"
  },
  {
    "stt": 41,
    "morningStart": "09:03",
    "morningEnd": "09:09",
    "afternoonStart": "14:33",
    "afternoonEnd": "14:39"
  },
  {
    "stt": 42,
    "morningStart": "09:05",
    "morningEnd": "09:11",
    "afternoonStart": "14:35",
    "afternoonEnd": "14:41"
  },
  {
    "stt": 43,
    "morningStart": "09:08",
    "morningEnd": "09:14",
    "afternoonStart": "14:38",
    "afternoonEnd": "14:44"
  },
  {
    "stt": 44,
    "morningStart": "09:10",
    "morningEnd": "09:16",
    "afternoonStart": "14:40",
    "afternoonEnd": "14:46"
  },
  {
    "stt": 45,
    "morningStart": "09:12",
    "morningEnd": "09:18",
    "afternoonStart": "14:42",
    "afternoonEnd": "14:48"
  },
  {
    "stt": 46,
    "morningStart": "09:15",
    "morningEnd": "09:21",
    "afternoonStart": "14:45",
    "afternoonEnd": "14:51"
  },
  {
    "stt": 47,
    "morningStart": "09:17",
    "morningEnd": "09:23",
    "afternoonStart": "14:47",
    "afternoonEnd": "14:53"
  },
  {
    "stt": 48,
    "morningStart": "09:19",
    "morningEnd": "09:25",
    "afternoonStart": "14:49",
    "afternoonEnd": "14:55"
  },
  {
    "stt": 49,
    "morningStart": "09:22",
    "morningEnd": "09:28",
    "afternoonStart": "14:52",
    "afternoonEnd": "14:58"
  },
  {
    "stt": 50,
    "morningStart": "09:24",
    "morningEnd": "09:30",
    "afternoonStart": "14:54",
    "afternoonEnd": "15:00"
  },
  {
    "stt": 51,
    "morningStart": "09:26",
    "morningEnd": "09:32",
    "afternoonStart": "14:56",
    "afternoonEnd": "15:02"
  },
  {
    "stt": 52,
    "morningStart": "09:29",
    "morningEnd": "09:35",
    "afternoonStart": "14:59",
    "afternoonEnd": "15:05"
  },
  {
    "stt": 53,
    "morningStart": "09:31",
    "morningEnd": "09:37",
    "afternoonStart": "15:01",
    "afternoonEnd": "15:07"
  },
  {
    "stt": 54,
    "morningStart": "09:33",
    "morningEnd": "09:39",
    "afternoonStart": "15:03",
    "afternoonEnd": "15:09"
  },
  {
    "stt": 55,
    "morningStart": "09:36",
    "morningEnd": "09:42",
    "afternoonStart": "15:06",
    "afternoonEnd": "15:12"
  },
  {
    "stt": 56,
    "morningStart": "09:38",
    "morningEnd": "09:44",
    "afternoonStart": "15:08",
    "afternoonEnd": "15:14"
  },
  {
    "stt": 57,
    "morningStart": "09:40",
    "morningEnd": "09:46",
    "afternoonStart": "15:10",
    "afternoonEnd": "15:16"
  },
  {
    "stt": 58,
    "morningStart": "09:43",
    "morningEnd": "09:49",
    "afternoonStart": "15:13",
    "afternoonEnd": "15:19"
  },
  {
    "stt": 59,
    "morningStart": "09:45",
    "morningEnd": "09:51",
    "afternoonStart": "15:15",
    "afternoonEnd": "15:21"
  },
  {
    "stt": 60,
    "morningStart": "09:47",
    "morningEnd": "09:53",
    "afternoonStart": "15:17",
    "afternoonEnd": "15:23"
  },
  {
    "stt": 61,
    "morningStart": "09:50",
    "morningEnd": "09:56",
    "afternoonStart": "15:20",
    "afternoonEnd": "15:26"
  },
  {
    "stt": 62,
    "morningStart": "09:52",
    "morningEnd": "09:58",
    "afternoonStart": "15:22",
    "afternoonEnd": "15:28"
  },
  {
    "stt": 63,
    "morningStart": "09:54",
    "morningEnd": "10:00",
    "afternoonStart": "15:24",
    "afternoonEnd": "15:30"
  },
  {
    "stt": 64,
    "morningStart": "09:57",
    "morningEnd": "10:03",
    "afternoonStart": "15:27",
    "afternoonEnd": "15:33"
  },
  {
    "stt": 65,
    "morningStart": "09:59",
    "morningEnd": "10:05",
    "afternoonStart": "15:29",
    "afternoonEnd": "15:35"
  },
  {
    "stt": 66,
    "morningStart": "10:01",
    "morningEnd": "10:07",
    "afternoonStart": "15:31",
    "afternoonEnd": "15:37"
  },
  {
    "stt": 67,
    "morningStart": "10:04",
    "morningEnd": "10:10",
    "afternoonStart": "15:34",
    "afternoonEnd": "15:40"
  },
  {
    "stt": 68,
    "morningStart": "10:06",
    "morningEnd": "10:12",
    "afternoonStart": "15:36",
    "afternoonEnd": "15:42"
  },
  {
    "stt": 69,
    "morningStart": "10:08",
    "morningEnd": "10:14",
    "afternoonStart": "15:38",
    "afternoonEnd": "15:44"
  },
  {
    "stt": 70,
    "morningStart": "10:11",
    "morningEnd": "10:17",
    "afternoonStart": "15:41",
    "afternoonEnd": "15:47"
  },
  {
    "stt": 71,
    "morningStart": "10:13",
    "morningEnd": "10:19",
    "afternoonStart": "15:43",
    "afternoonEnd": "15:49"
  },
  {
    "stt": 72,
    "morningStart": "10:15",
    "morningEnd": "10:21",
    "afternoonStart": "15:45",
    "afternoonEnd": "15:51"
  },
  {
    "stt": 73,
    "morningStart": "10:18",
    "morningEnd": "10:24",
    "afternoonStart": "15:48",
    "afternoonEnd": "15:54"
  },
  {
    "stt": 74,
    "morningStart": "10:20",
    "morningEnd": "10:26",
    "afternoonStart": "15:50",
    "afternoonEnd": "15:56"
  },
  {
    "stt": 75,
    "morningStart": "10:22",
    "morningEnd": "10:28",
    "afternoonStart": "15:52",
    "afternoonEnd": "15:58"
  },
  {
    "stt": 76,
    "morningStart": "10:25",
    "morningEnd": "10:31",
    "afternoonStart": "15:55",
    "afternoonEnd": "16:01"
  },
  {
    "stt": 77,
    "morningStart": "10:27",
    "morningEnd": "10:33",
    "afternoonStart": "15:57",
    "afternoonEnd": "16:03"
  },
  {
    "stt": 78,
    "morningStart": "10:29",
    "morningEnd": "10:35",
    "afternoonStart": "15:59",
    "afternoonEnd": "16:05"
  },
  {
    "stt": 79,
    "morningStart": "10:32",
    "morningEnd": "10:38",
    "afternoonStart": "16:02",
    "afternoonEnd": "16:08"
  },
  {
    "stt": 80,
    "morningStart": "10:34",
    "morningEnd": "10:40",
    "afternoonStart": "16:04",
    "afternoonEnd": "16:10"
  },
  {
    "stt": 81,
    "morningStart": "10:36",
    "morningEnd": "10:42",
    "afternoonStart": "16:06",
    "afternoonEnd": "16:12"
  },
  {
    "stt": 82,
    "morningStart": "10:39",
    "morningEnd": "10:45",
    "afternoonStart": "16:09",
    "afternoonEnd": "16:15"
  },
  {
    "stt": 83,
    "morningStart": "10:41",
    "morningEnd": "10:47",
    "afternoonStart": "16:11",
    "afternoonEnd": "16:17"
  },
  {
    "stt": 84,
    "morningStart": "10:43",
    "morningEnd": "10:49",
    "afternoonStart": "16:13",
    "afternoonEnd": "16:19"
  },
  {
    "stt": 85,
    "morningStart": "10:46",
    "morningEnd": "10:52",
    "afternoonStart": "16:16",
    "afternoonEnd": "16:22"
  },
  {
    "stt": 86,
    "morningStart": "10:48",
    "morningEnd": "10:54",
    "afternoonStart": "16:18",
    "afternoonEnd": "16:24"
  },
  {
    "stt": 87,
    "morningStart": "10:50",
    "morningEnd": "10:56",
    "afternoonStart": "16:20",
    "afternoonEnd": "16:26"
  },
  {
    "stt": 88,
    "morningStart": "10:53",
    "morningEnd": "10:59",
    "afternoonStart": "16:23",
    "afternoonEnd": "16:29"
  },
  {
    "stt": 89,
    "morningStart": "10:55",
    "morningEnd": "11:01",
    "afternoonStart": "16:25",
    "afternoonEnd": "16:31"
  },
  {
    "stt": 90,
    "morningStart": "10:57",
    "morningEnd": "11:03",
    "afternoonStart": "16:27",
    "afternoonEnd": "16:33"
  },
  {
    "stt": 91,
    "morningStart": "11:00",
    "morningEnd": "11:06",
    "afternoonStart": "16:30",
    "afternoonEnd": "16:36"
  },
  {
    "stt": 92,
    "morningStart": "11:02",
    "morningEnd": "11:08",
    "afternoonStart": "16:32",
    "afternoonEnd": "16:38"
  },
  {
    "stt": 93,
    "morningStart": "11:04",
    "morningEnd": "11:10",
    "afternoonStart": "16:34",
    "afternoonEnd": "16:40"
  },
  {
    "stt": 94,
    "morningStart": "11:07",
    "morningEnd": "11:13",
    "afternoonStart": "16:37",
    "afternoonEnd": "16:43"
  },
  {
    "stt": 95,
    "morningStart": "11:09",
    "morningEnd": "11:15",
    "afternoonStart": "16:39",
    "afternoonEnd": "16:45"
  },
  {
    "stt": 96,
    "morningStart": "11:11",
    "morningEnd": "11:17",
    "afternoonStart": "16:41",
    "afternoonEnd": "16:47"
  },
  {
    "stt": 97,
    "morningStart": "11:14",
    "morningEnd": "11:20",
    "afternoonStart": "16:44",
    "afternoonEnd": "16:50"
  },
  {
    "stt": 98,
    "morningStart": "11:16",
    "morningEnd": "11:22",
    "afternoonStart": "16:46",
    "afternoonEnd": "16:52"
  },
  {
    "stt": 99,
    "morningStart": "11:18",
    "morningEnd": "11:24",
    "afternoonStart": "16:48",
    "afternoonEnd": "16:54"
  },
  {
    "stt": 100,
    "morningStart": "11:21",
    "morningEnd": "11:27",
    "afternoonStart": "16:51",
    "afternoonEnd": "16:57"
  },
  {
    "stt": 101,
    "morningStart": "11:23",
    "morningEnd": "11:29",
    "afternoonStart": "16:53",
    "afternoonEnd": "16:59"
  },
  {
    "stt": 102,
    "morningStart": "11:25",
    "morningEnd": "11:31",
    "afternoonStart": "16:55",
    "afternoonEnd": "17:01"
  },
  {
    "stt": 103,
    "morningStart": "11:28",
    "morningEnd": "11:34",
    "afternoonStart": "16:58",
    "afternoonEnd": "17:04"
  }
];

export const DR_GEM_ROWS: ScheduleRow[] = [
  {
    "stt": 1,
    "morningStart": "07:31",
    "morningEnd": "07:37",
    "afternoonStart": "13:01",
    "afternoonEnd": "13:07"
  },
  {
    "stt": 2,
    "morningStart": "07:33",
    "morningEnd": "07:39",
    "afternoonStart": "13:03",
    "afternoonEnd": "13:09"
  },
  {
    "stt": 3,
    "morningStart": "07:35",
    "morningEnd": "07:41",
    "afternoonStart": "13:06",
    "afternoonEnd": "13:12"
  },
  {
    "stt": 4,
    "morningStart": "07:38",
    "morningEnd": "07:44",
    "afternoonStart": "13:08",
    "afternoonEnd": "13:14"
  },
  {
    "stt": 5,
    "morningStart": "07:40",
    "morningEnd": "07:46",
    "afternoonStart": "13:10",
    "afternoonEnd": "13:16"
  },
  {
    "stt": 6,
    "morningStart": "07:42",
    "morningEnd": "07:48",
    "afternoonStart": "13:13",
    "afternoonEnd": "13:19"
  },
  {
    "stt": 7,
    "morningStart": "07:45",
    "morningEnd": "07:51",
    "afternoonStart": "13:15",
    "afternoonEnd": "13:21"
  },
  {
    "stt": 8,
    "morningStart": "07:47",
    "morningEnd": "07:53",
    "afternoonStart": "13:17",
    "afternoonEnd": "13:23"
  },
  {
    "stt": 9,
    "morningStart": "07:49",
    "morningEnd": "07:55",
    "afternoonStart": "13:20",
    "afternoonEnd": "13:26"
  },
  {
    "stt": 10,
    "morningStart": "07:52",
    "morningEnd": "07:58",
    "afternoonStart": "13:22",
    "afternoonEnd": "13:28"
  },
  {
    "stt": 11,
    "morningStart": "07:54",
    "morningEnd": "08:00",
    "afternoonStart": "13:24",
    "afternoonEnd": "13:30"
  },
  {
    "stt": 12,
    "morningStart": "07:56",
    "morningEnd": "08:02",
    "afternoonStart": "13:27",
    "afternoonEnd": "13:33"
  },
  {
    "stt": 13,
    "morningStart": "07:59",
    "morningEnd": "08:05",
    "afternoonStart": "13:29",
    "afternoonEnd": "13:35"
  },
  {
    "stt": 14,
    "morningStart": "08:01",
    "morningEnd": "08:07",
    "afternoonStart": "13:31",
    "afternoonEnd": "13:37"
  },
  {
    "stt": 15,
    "morningStart": "08:03",
    "morningEnd": "08:09",
    "afternoonStart": "13:34",
    "afternoonEnd": "13:40"
  },
  {
    "stt": 16,
    "morningStart": "08:06",
    "morningEnd": "08:12",
    "afternoonStart": "13:36",
    "afternoonEnd": "13:42"
  },
  {
    "stt": 17,
    "morningStart": "08:08",
    "morningEnd": "08:14",
    "afternoonStart": "13:38",
    "afternoonEnd": "13:44"
  },
  {
    "stt": 18,
    "morningStart": "08:10",
    "morningEnd": "08:16",
    "afternoonStart": "13:41",
    "afternoonEnd": "13:47"
  },
  {
    "stt": 19,
    "morningStart": "08:13",
    "morningEnd": "08:19",
    "afternoonStart": "13:43",
    "afternoonEnd": "13:49"
  },
  {
    "stt": 20,
    "morningStart": "08:15",
    "morningEnd": "08:21",
    "afternoonStart": "13:45",
    "afternoonEnd": "13:51"
  },
  {
    "stt": 21,
    "morningStart": "08:17",
    "morningEnd": "08:23",
    "afternoonStart": "13:48",
    "afternoonEnd": "13:54"
  },
  {
    "stt": 22,
    "morningStart": "08:20",
    "morningEnd": "08:26",
    "afternoonStart": "13:50",
    "afternoonEnd": "13:56"
  },
  {
    "stt": 23,
    "morningStart": "08:22",
    "morningEnd": "08:28",
    "afternoonStart": "13:52",
    "afternoonEnd": "13:58"
  },
  {
    "stt": 24,
    "morningStart": "08:24",
    "morningEnd": "08:30",
    "afternoonStart": "13:55",
    "afternoonEnd": "14:01"
  },
  {
    "stt": 25,
    "morningStart": "08:27",
    "morningEnd": "08:33",
    "afternoonStart": "13:57",
    "afternoonEnd": "14:03"
  },
  {
    "stt": 26,
    "morningStart": "08:29",
    "morningEnd": "08:35",
    "afternoonStart": "13:59",
    "afternoonEnd": "14:05"
  },
  {
    "stt": 27,
    "morningStart": "08:31",
    "morningEnd": "08:37",
    "afternoonStart": "14:02",
    "afternoonEnd": "14:08"
  },
  {
    "stt": 28,
    "morningStart": "08:34",
    "morningEnd": "08:40",
    "afternoonStart": "14:04",
    "afternoonEnd": "14:10"
  },
  {
    "stt": 29,
    "morningStart": "08:36",
    "morningEnd": "08:42",
    "afternoonStart": "14:06",
    "afternoonEnd": "14:12"
  },
  {
    "stt": 30,
    "morningStart": "08:38",
    "morningEnd": "08:44",
    "afternoonStart": "14:09",
    "afternoonEnd": "14:15"
  },
  {
    "stt": 31,
    "morningStart": "08:41",
    "morningEnd": "08:47",
    "afternoonStart": "14:11",
    "afternoonEnd": "14:17"
  },
  {
    "stt": 32,
    "morningStart": "08:43",
    "morningEnd": "08:49",
    "afternoonStart": "14:13",
    "afternoonEnd": "14:19"
  },
  {
    "stt": 33,
    "morningStart": "08:45",
    "morningEnd": "08:51",
    "afternoonStart": "14:16",
    "afternoonEnd": "14:22"
  },
  {
    "stt": 34,
    "morningStart": "08:48",
    "morningEnd": "08:54",
    "afternoonStart": "14:18",
    "afternoonEnd": "14:24"
  },
  {
    "stt": 35,
    "morningStart": "08:50",
    "morningEnd": "08:56",
    "afternoonStart": "14:20",
    "afternoonEnd": "14:26"
  },
  {
    "stt": 36,
    "morningStart": "08:52",
    "morningEnd": "08:58",
    "afternoonStart": "14:23",
    "afternoonEnd": "14:29"
  },
  {
    "stt": 37,
    "morningStart": "08:55",
    "morningEnd": "09:01",
    "afternoonStart": "14:25",
    "afternoonEnd": "14:31"
  },
  {
    "stt": 38,
    "morningStart": "08:57",
    "morningEnd": "09:03",
    "afternoonStart": "14:27",
    "afternoonEnd": "14:33"
  },
  {
    "stt": 39,
    "morningStart": "08:59",
    "morningEnd": "09:05",
    "afternoonStart": "14:30",
    "afternoonEnd": "14:36"
  },
  {
    "stt": 40,
    "morningStart": "09:02",
    "morningEnd": "09:08",
    "afternoonStart": "14:32",
    "afternoonEnd": "14:38"
  },
  {
    "stt": 41,
    "morningStart": "09:04",
    "morningEnd": "09:10",
    "afternoonStart": "14:34",
    "afternoonEnd": "14:40"
  },
  {
    "stt": 42,
    "morningStart": "09:06",
    "morningEnd": "09:12",
    "afternoonStart": "14:37",
    "afternoonEnd": "14:43"
  },
  {
    "stt": 43,
    "morningStart": "09:09",
    "morningEnd": "09:15",
    "afternoonStart": "14:39",
    "afternoonEnd": "14:45"
  },
  {
    "stt": 44,
    "morningStart": "09:11",
    "morningEnd": "09:17",
    "afternoonStart": "14:41",
    "afternoonEnd": "14:47"
  },
  {
    "stt": 45,
    "morningStart": "09:13",
    "morningEnd": "09:19",
    "afternoonStart": "14:44",
    "afternoonEnd": "14:50"
  },
  {
    "stt": 46,
    "morningStart": "09:16",
    "morningEnd": "09:22",
    "afternoonStart": "14:46",
    "afternoonEnd": "14:52"
  },
  {
    "stt": 47,
    "morningStart": "09:18",
    "morningEnd": "09:24",
    "afternoonStart": "14:48",
    "afternoonEnd": "14:54"
  },
  {
    "stt": 48,
    "morningStart": "09:20",
    "morningEnd": "09:26",
    "afternoonStart": "14:51",
    "afternoonEnd": "14:57"
  },
  {
    "stt": 49,
    "morningStart": "09:23",
    "morningEnd": "09:29",
    "afternoonStart": "14:53",
    "afternoonEnd": "14:59"
  },
  {
    "stt": 50,
    "morningStart": "09:25",
    "morningEnd": "09:31",
    "afternoonStart": "14:55",
    "afternoonEnd": "15:01"
  },
  {
    "stt": 51,
    "morningStart": "09:27",
    "morningEnd": "09:33",
    "afternoonStart": "14:58",
    "afternoonEnd": "15:04"
  },
  {
    "stt": 52,
    "morningStart": "09:30",
    "morningEnd": "09:36",
    "afternoonStart": "15:00",
    "afternoonEnd": "15:06"
  },
  {
    "stt": 53,
    "morningStart": "09:32",
    "morningEnd": "09:38",
    "afternoonStart": "15:02",
    "afternoonEnd": "15:08"
  },
  {
    "stt": 54,
    "morningStart": "09:34",
    "morningEnd": "09:40",
    "afternoonStart": "15:05",
    "afternoonEnd": "15:11"
  },
  {
    "stt": 55,
    "morningStart": "09:37",
    "morningEnd": "09:43",
    "afternoonStart": "15:07",
    "afternoonEnd": "15:13"
  },
  {
    "stt": 56,
    "morningStart": "09:39",
    "morningEnd": "09:45",
    "afternoonStart": "15:09",
    "afternoonEnd": "15:15"
  },
  {
    "stt": 57,
    "morningStart": "09:41",
    "morningEnd": "09:47",
    "afternoonStart": "15:12",
    "afternoonEnd": "15:18"
  },
  {
    "stt": 58,
    "morningStart": "09:44",
    "morningEnd": "09:50",
    "afternoonStart": "15:14",
    "afternoonEnd": "15:20"
  },
  {
    "stt": 59,
    "morningStart": "09:46",
    "morningEnd": "09:52",
    "afternoonStart": "15:16",
    "afternoonEnd": "15:22"
  },
  {
    "stt": 60,
    "morningStart": "09:48",
    "morningEnd": "09:54",
    "afternoonStart": "15:19",
    "afternoonEnd": "15:25"
  },
  {
    "stt": 61,
    "morningStart": "09:51",
    "morningEnd": "09:57",
    "afternoonStart": "15:21",
    "afternoonEnd": "15:27"
  },
  {
    "stt": 62,
    "morningStart": "09:53",
    "morningEnd": "09:59",
    "afternoonStart": "15:23",
    "afternoonEnd": "15:29"
  },
  {
    "stt": 63,
    "morningStart": "09:55",
    "morningEnd": "10:01",
    "afternoonStart": "15:26",
    "afternoonEnd": "15:32"
  },
  {
    "stt": 64,
    "morningStart": "09:58",
    "morningEnd": "10:04",
    "afternoonStart": "15:28",
    "afternoonEnd": "15:34"
  },
  {
    "stt": 65,
    "morningStart": "10:00",
    "morningEnd": "10:06",
    "afternoonStart": "15:30",
    "afternoonEnd": "15:36"
  },
  {
    "stt": 66,
    "morningStart": "10:02",
    "morningEnd": "10:08",
    "afternoonStart": "15:33",
    "afternoonEnd": "15:39"
  },
  {
    "stt": 67,
    "morningStart": "10:05",
    "morningEnd": "10:11",
    "afternoonStart": "15:35",
    "afternoonEnd": "15:41"
  },
  {
    "stt": 68,
    "morningStart": "10:07",
    "morningEnd": "10:13",
    "afternoonStart": "15:37",
    "afternoonEnd": "15:43"
  },
  {
    "stt": 69,
    "morningStart": "10:09",
    "morningEnd": "10:15",
    "afternoonStart": "15:40",
    "afternoonEnd": "15:46"
  },
  {
    "stt": 70,
    "morningStart": "10:12",
    "morningEnd": "10:18",
    "afternoonStart": "15:42",
    "afternoonEnd": "15:48"
  },
  {
    "stt": 71,
    "morningStart": "10:14",
    "morningEnd": "10:20",
    "afternoonStart": "15:44",
    "afternoonEnd": "15:50"
  },
  {
    "stt": 72,
    "morningStart": "10:16",
    "morningEnd": "10:22",
    "afternoonStart": "15:47",
    "afternoonEnd": "15:53"
  },
  {
    "stt": 73,
    "morningStart": "10:19",
    "morningEnd": "10:25",
    "afternoonStart": "15:49",
    "afternoonEnd": "15:55"
  },
  {
    "stt": 74,
    "morningStart": "10:21",
    "morningEnd": "10:27",
    "afternoonStart": "15:51",
    "afternoonEnd": "15:57"
  },
  {
    "stt": 75,
    "morningStart": "10:23",
    "morningEnd": "10:29",
    "afternoonStart": "15:54",
    "afternoonEnd": "16:00"
  },
  {
    "stt": 76,
    "morningStart": "10:26",
    "morningEnd": "10:32",
    "afternoonStart": "15:56",
    "afternoonEnd": "16:02"
  },
  {
    "stt": 77,
    "morningStart": "10:28",
    "morningEnd": "10:34",
    "afternoonStart": "15:58",
    "afternoonEnd": "16:04"
  },
  {
    "stt": 78,
    "morningStart": "10:30",
    "morningEnd": "10:36",
    "afternoonStart": "16:01",
    "afternoonEnd": "16:07"
  },
  {
    "stt": 79,
    "morningStart": "10:33",
    "morningEnd": "10:39",
    "afternoonStart": "16:03",
    "afternoonEnd": "16:09"
  },
  {
    "stt": 80,
    "morningStart": "10:35",
    "morningEnd": "10:41",
    "afternoonStart": "16:05",
    "afternoonEnd": "16:11"
  },
  {
    "stt": 81,
    "morningStart": "10:37",
    "morningEnd": "10:43",
    "afternoonStart": "16:08",
    "afternoonEnd": "16:14"
  },
  {
    "stt": 82,
    "morningStart": "10:40",
    "morningEnd": "10:46",
    "afternoonStart": "16:10",
    "afternoonEnd": "16:16"
  },
  {
    "stt": 83,
    "morningStart": "10:42",
    "morningEnd": "10:48",
    "afternoonStart": "16:12",
    "afternoonEnd": "16:18"
  },
  {
    "stt": 84,
    "morningStart": "10:44",
    "morningEnd": "10:50",
    "afternoonStart": "16:15",
    "afternoonEnd": "16:21"
  },
  {
    "stt": 85,
    "morningStart": "10:47",
    "morningEnd": "10:53",
    "afternoonStart": "16:17",
    "afternoonEnd": "16:23"
  },
  {
    "stt": 86,
    "morningStart": "10:49",
    "morningEnd": "10:55",
    "afternoonStart": "16:19",
    "afternoonEnd": "16:25"
  },
  {
    "stt": 87,
    "morningStart": "10:51",
    "morningEnd": "10:57",
    "afternoonStart": "16:22",
    "afternoonEnd": "16:28"
  },
  {
    "stt": 88,
    "morningStart": "10:54",
    "morningEnd": "11:00",
    "afternoonStart": "16:24",
    "afternoonEnd": "16:30"
  },
  {
    "stt": 89,
    "morningStart": "10:56",
    "morningEnd": "11:02",
    "afternoonStart": "16:26",
    "afternoonEnd": "16:32"
  },
  {
    "stt": 90,
    "morningStart": "10:58",
    "morningEnd": "11:04",
    "afternoonStart": "16:29",
    "afternoonEnd": "16:35"
  },
  {
    "stt": 91,
    "morningStart": "11:01",
    "morningEnd": "11:07",
    "afternoonStart": "16:31",
    "afternoonEnd": "16:37"
  },
  {
    "stt": 92,
    "morningStart": "11:03",
    "morningEnd": "11:09",
    "afternoonStart": "16:33",
    "afternoonEnd": "16:39"
  },
  {
    "stt": 93,
    "morningStart": "11:05",
    "morningEnd": "11:11",
    "afternoonStart": "16:36",
    "afternoonEnd": "16:42"
  },
  {
    "stt": 94,
    "morningStart": "11:08",
    "morningEnd": "11:14",
    "afternoonStart": "16:38",
    "afternoonEnd": "16:44"
  },
  {
    "stt": 95,
    "morningStart": "11:10",
    "morningEnd": "11:16",
    "afternoonStart": "16:40",
    "afternoonEnd": "16:46"
  },
  {
    "stt": 96,
    "morningStart": "11:12",
    "morningEnd": "11:18",
    "afternoonStart": "16:43",
    "afternoonEnd": "16:49"
  },
  {
    "stt": 97,
    "morningStart": "11:15",
    "morningEnd": "11:21",
    "afternoonStart": "16:45",
    "afternoonEnd": "16:51"
  },
  {
    "stt": 98,
    "morningStart": "11:17",
    "morningEnd": "11:23",
    "afternoonStart": "16:47",
    "afternoonEnd": "16:53"
  },
  {
    "stt": 99,
    "morningStart": "11:19",
    "morningEnd": "11:25",
    "afternoonStart": "16:50",
    "afternoonEnd": "16:56"
  },
  {
    "stt": 100,
    "morningStart": "11:22",
    "morningEnd": "11:28",
    "afternoonStart": "16:52",
    "afternoonEnd": "16:58"
  },
  {
    "stt": 101,
    "morningStart": "11:24",
    "morningEnd": "11:30",
    "afternoonStart": "16:54",
    "afternoonEnd": "17:00"
  },
  {
    "stt": 102,
    "morningStart": "11:26",
    "morningEnd": "11:32",
    "afternoonStart": "16:57",
    "afternoonEnd": "17:03"
  },
  {
    "stt": 103,
    "morningStart": "11:29",
    "morningEnd": "11:35",
    "afternoonStart": "16:59",
    "afternoonEnd": "17:05"
  }
];

export const MACHINES: MachineConfig[] = [
  {
    key: 'TITAN2000',
    id: 'titan-2000',
    name: 'TITAN 2000',
    fullTitle: 'MÁY CHỤP X QUANG TITAN 2000',
    supervisor: 'Nguyễn Văn Hải',
    totalRows: TITAN2000_ROWS.length,
    defaultTheme: 'green',
    rows: TITAN2000_ROWS,
  },
  {
    key: 'DR_GEM',
    id: 'dr-gem',
    name: 'DR GEM',
    fullTitle: 'MÁY CHỤP X QUANG DR GEM',
    supervisor: 'Trần Văn Huấn',
    totalRows: DR_GEM_ROWS.length,
    defaultTheme: 'purple',
    rows: DR_GEM_ROWS,
  },
];

export const MACHINE_MAP: Record<MachineKey, MachineConfig> = {
  TITAN2000: MACHINES[0],
  DR_GEM: MACHINES[1],
};
