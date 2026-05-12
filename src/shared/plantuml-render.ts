export type FetchPlantUmlSvgMessage = {
  type: "show-pic-fetch-plantuml-svg";
  url: string;
};

export type FetchPlantUmlSvgResponse =
  | {
      ok: true;
      svg: string;
    }
  | {
      ok: false;
      error: string;
    };
