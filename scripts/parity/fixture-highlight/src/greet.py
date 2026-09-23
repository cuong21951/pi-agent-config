# Greeting helpers
GREETING_COUNT = 0


class Greeter:
    def __init__(self, name: str):
        self.name = name

    def greet(self):
        global GREETING_COUNT
        GREETING_COUNT += 1
        return f"Hello, {self.name}! (#{GREETING_COUNT})"
