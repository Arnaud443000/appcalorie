"""Learned frame interpolation helpers (RIFE IFNet v4.26 heavy, via the `ccvfi` package).

Used for two things:
  * the baseline/comparison (plain RIFE between A and B, like the first attempt);
  * the "hybrid" variant: the puppet renders the limb from source A and from source
    B at the *same* pose, then RIFE blends the two pre-aligned renders instead of a
    plain cross-dissolve, so the remaining small texture misalignment is warped
    rather than double-exposed.
"""
import cv2
import numpy as np
import torch


class Rife:
    def __init__(self, scale=1.0):
        from ccvfi import AutoConfig, AutoModel, ConfigType  # noqa: F401
        torch.set_num_threads(max(torch.get_num_threads(), 1))
        self.model = AutoModel.from_pretrained(ConfigType.RIFE_IFNet_v426_heavy, device=torch.device("cpu"), fp16=False)
        self.scale = scale

    @torch.inference_mode()
    def interp(self, img0, img1, t):
        """img0/img1: RGB float arrays in [0,255], same size. Returns RGB float."""
        h, w = img0.shape[:2]
        ph, pw = (64 - h % 64) % 64, (64 - w % 64) % 64

        def prep(im):
            x = torch.from_numpy(np.ascontiguousarray(im.transpose(2, 0, 1)) / 255.0).float()[None]
            return torch.nn.functional.pad(x, (0, pw, 0, ph), mode="replicate")

        inp = torch.stack([prep(img0), prep(img1)], dim=1)
        out = self.model.inference(inp, timestep=float(t), scale=self.scale)
        return out[0, :, :h, :w].permute(1, 2, 0).numpy() * 255.0


class RifeBlender:
    """Hybrid renderer: puppet geometry + RIFE blend of the two aligned limb renders."""

    def __init__(self, weights=None, scale=1.0):
        self.rife = Rife(scale)

    def render(self, puppet, s):
        override_a, override_b = {}, {}
        weight = None
        for L in puppet.layers:
            if L is not None and hasattr(L, "sources") and len(L.sources) > 1:
                main, alt, wB = L.render(s, return_both=True)
                if wB <= 0.0 or wB >= 1.0:
                    continue
                # frame "a" uses the alt (A) source, frame "b" the main (B) source
                override_a[L.name] = alt
                override_b[L.name] = main
                weight = wB
        if weight is None:
            return puppet.render(s)
        fa = puppet.render(s, limb_override=override_a)
        fb = puppet.render(s, limb_override=override_b)
        out = self.rife.interp(fa, fb, weight)
        # keep everything outside the blended limbs pixel-exact
        m = np.zeros(fa.shape[:2], np.float32)
        for name in override_a:
            m = np.maximum(m, np.maximum(override_a[name][1], override_b[name][1]))
        m = cv2.dilate(m, np.ones((9, 9), np.uint8))
        m = cv2.GaussianBlur(m, (0, 0), 3)[..., None]
        # outside the limb masks fa and fb are identical
        return out * m + fb * (1 - m)
