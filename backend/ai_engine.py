import re

from foundry_local_sdk import Configuration, FoundryLocalManager


class IncidentLensAI:

    def __init__(self):
        self.model = None
        self.client = None
        self.manager = None

    # =========================================================
    # INITIALIZE MODEL
    # =========================================================

    def initialize(self):

        print("=" * 60)
        print("IncidentLens AI is starting...")
        print("=" * 60)

        # Initialize Foundry Local
        config = Configuration(
            app_name="IncidentLensAI"
        )

        FoundryLocalManager.initialize(config)

        self.manager = FoundryLocalManager.instance

        # Select model
        model_alias = "qwen3.5-4b"

        print(f"Selecting model: {model_alias}")

        self.model = self.manager.catalog.get_model(
            model_alias
        )

        if self.model is None:
            raise RuntimeError(
                f"Model not found: {model_alias}"
            )

        print(f"Model found: {self.model.alias}")

        # =====================================================
        # MODEL CACHE
        # =====================================================

        if not self.model.is_cached:

            print("Model is not cached locally.")
            print("Downloading model...")

            self.model.download(
                lambda progress: print(
                    f"\rDownloading model: {progress:.1f}%",
                    end="",
                    flush=True
                )
            )

            print()

        else:

            print("Model is already available locally.")

        # =====================================================
        # LOAD MODEL
        # =====================================================

        print("Loading model...")

        self.model.load()

        print(
            f"Model loaded: {self.model.is_loaded}"
        )

        if not self.model.is_loaded:

            raise RuntimeError(
                "Model failed to load."
            )

        print("MODEL READY!")

        # =====================================================
        # CHAT CLIENT
        # =====================================================

        print("Creating chat client...")

        self.client = self.model.get_chat_client()

        if self.client is None:

            raise RuntimeError(
                "Failed to create chat client."
            )

        print("Chat client ready.")

        print("=" * 60)

    # =========================================================
    # CLEAN MODEL RESPONSE
    # =========================================================

    def clean_response(self, response: str) -> str:

        if not response:
            return ""

        # -----------------------------------------------------
        # Remove <think>...</think> blocks
        # -----------------------------------------------------

        response = re.sub(
            r"<think>.*?</think>",
            "",
            response,
            flags=re.DOTALL | re.IGNORECASE
        )

        # -----------------------------------------------------
        # Remove standalone thinking tags
        # -----------------------------------------------------

        response = re.sub(
            r"</?think>",
            "",
            response,
            flags=re.IGNORECASE
        )

        # -----------------------------------------------------
        # Find the FINAL report.
        #
        # Qwen may generate reasoning such as:
        #
        # "I need to determine the severity..."
        #
        # and may even mention:
        #
        # "1. Severity"
        #
        # during its reasoning.
        #
        # Therefore we intentionally use the LAST occurrence.
        # -----------------------------------------------------

        final_pattern = re.compile(
            r"(?im)^\s*1\.\s*Severity\s*:?\s*$"
        )

        matches = list(
            final_pattern.finditer(response)
        )

        if matches:

            # Take the last "1. Severity" occurrence.
            response = response[
                matches[-1].start():
            ]

        else:

            # Fallback for slightly different formatting.
            markers = [
                "1. Severity:",
                "1. Severity",
            ]

            start_index = -1

            for marker in markers:

                index = response.rfind(marker)

                if index > start_index:
                    start_index = index

            if start_index != -1:
                response = response[start_index:]

        # -----------------------------------------------------
        # Remove accidental closing thinking tags
        # -----------------------------------------------------

        response = re.sub(
            r"</?think>",
            "",
            response,
            flags=re.IGNORECASE
        )

        # -----------------------------------------------------
        # Remove markdown code fences if the model adds them
        # -----------------------------------------------------

        response = re.sub(
            r"^```(?:text|markdown)?\s*",
            "",
            response,
            flags=re.IGNORECASE
        )

        response = re.sub(
            r"\s*```$",
            "",
            response
        )

        # -----------------------------------------------------
        # Remove accidental introductory phrases
        # -----------------------------------------------------

        response = re.sub(
            r"^\s*(Okay|Sure|Certainly|Here is|Here’s).*?\n+",
            "",
            response,
            flags=re.IGNORECASE
        )

        # -----------------------------------------------------
        # Normalize excessive blank lines
        # -----------------------------------------------------

        response = re.sub(
            r"\n{3,}",
            "\n\n",
            response
        )

        response = response.strip()

        return response

    # =========================================================
    # ANALYZE INCIDENT
    # =========================================================

    def analyze_incident(
        self,
        incident_text: str
    ) -> str:

        if not self.client:

            raise RuntimeError(
                "AI model is not ready."
            )

        if not self.model:

            raise RuntimeError(
                "Model is not available."
            )

        if not self.model.is_loaded:

            raise RuntimeError(
                "Model is not currently loaded."
            )

        # =====================================================
        # SYSTEM PROMPT
        # =====================================================

        system_prompt = """
You are IncidentLens AI, a professional technical incident
analysis assistant.

Your job is to analyze production incidents and generate
concise, professional and actionable incident reports.

You MUST follow the exact five-section structure below:

1. Severity

2. Observed Symptoms

3. Possible Root Causes

4. Initial Response Recommendations

5. Short Incident Summary

STRICT OUTPUT RULES:

- Respond entirely in English.
- Do not respond in Turkish.
- Do not mix languages.
- Do not show reasoning.
- Do not show internal analysis.
- Do not show thinking.
- Do not show a chain of thought.
- Do not describe your decision-making process.
- Do not include a "Thinking Process" section.
- Do not include analysis before the final report.
- Do not include analysis after the final report.
- Do not use <think> tags.
- Do not say "Okay".
- Do not say "Sure".
- Do not say "First".
- Do not say "Next".
- Do not say "Let me analyze".
- Do not say "I need to".
- Do not explain the task.
- Do not repeat the incident description unnecessarily.
- Start the response immediately with:

1. Severity

- Keep the report concise.
- Use professional technical language.
- Severity must be based on actual business and user impact.
- Consider payment failures, data loss, service disruption,
  production downtime and critical business functionality.
- Root causes must be described as possibilities, not facts.
- Use words such as "Possible" or "Likely" for root causes.
- Do not claim an unverified root cause as confirmed.
- Output ONLY the final five-section incident report.
"""

        # =====================================================
        # USER PROMPT
        # =====================================================

        user_prompt = f"""
Analyze the following production incident.

INCIDENT:

{incident_text}

Return ONLY the final incident report.

The response must:

- Be entirely in English.
- Start immediately with "1. Severity".
- Contain exactly five sections.
- Contain no reasoning.
- Contain no thinking process.
- Contain no internal analysis.
- Contain no introduction.
- Contain no conclusion outside the five sections.
- Contain no Turkish.
- Contain no mixed-language text.

Required structure:

1. Severity

2. Observed Symptoms

3. Possible Root Causes

4. Initial Response Recommendations

5. Short Incident Summary
"""

        messages = [

            {
                "role": "system",
                "content": system_prompt
            },

            {
                "role": "user",
                "content": user_prompt
            }

        ]

        print()
        print("-" * 60)
        print("INCIDENT ANALYSIS STARTED")
        print("-" * 60)

        # =====================================================
        # STREAMING CHAT
        # =====================================================

        try:

            full_response = ""

            for chunk in self.client.complete_streaming_chat(
                messages
            ):

                if not chunk.choices:
                    continue

                content = chunk.choices[0].delta.content

                if content:

                    # IMPORTANT:
                    # Do NOT print raw model output.
                    #
                    # Qwen may expose its reasoning here.
                    # We keep it internally and only return
                    # the cleaned final response to the frontend.

                    full_response += content

            print("Model response received.")

            # -------------------------------------------------
            # Validate raw response
            # -------------------------------------------------

            if not full_response.strip():

                raise RuntimeError(
                    "Model returned an empty response."
                )

            # -------------------------------------------------
            # Clean reasoning and extract final report
            # -------------------------------------------------

            clean_result = self.clean_response(
                full_response
            )

            if not clean_result.strip():

                raise RuntimeError(
                    "No usable final report was returned."
                )

            # -------------------------------------------------
            # Final backend logging
            # -------------------------------------------------

            print("Final report extracted successfully.")
            print("INCIDENT ANALYSIS COMPLETED")
            print("-" * 60)

            # -------------------------------------------------
            # Frontend receives ONLY the cleaned final report.
            # -------------------------------------------------

            return clean_result

        except Exception as e:

            print()
            print("=" * 60)
            print("MODEL ERROR")
            print("=" * 60)
            print(str(e))
            print("=" * 60)

            raise RuntimeError(
                f"AI analysis failed: {str(e)}"
            )

    # =========================================================
    # SHUTDOWN MODEL
    # =========================================================

    def shutdown(self):

        if self.model:

            print("Shutting down model...")

            try:

                self.model.unload()

            except Exception as e:

                print(
                    f"Error while shutting down model: {e}"
                )

            self.client = None
            self.model = None

            print("Model shut down.")


# =============================================================
# SINGLE AI INSTANCE FOR THE APPLICATION
# =============================================================

incident_ai = IncidentLensAI()