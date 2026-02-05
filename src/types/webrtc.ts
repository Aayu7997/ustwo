export type RTCIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type RTCConfiguration = {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
};
