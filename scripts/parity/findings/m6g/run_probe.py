import os, sys

PARITY = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
source = open(os.path.join(PARITY, "run.py"), encoding="utf-8").read()
line = 'MOCK = os.path.join(HERE, "mock.py")\n'
assert line in source
source = source.replace(line, f'MOCK = {os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_probe.py")!r}\n')
__file__ = os.path.join(PARITY, "run.py")
exec(compile(source, __file__, "exec"))
