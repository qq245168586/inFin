import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.geom.Arc2D;
import java.awt.geom.Ellipse2D;
import java.awt.geom.GeneralPath;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

public final class RenderTvLauncherIcon {
  private static final String APP_ROOT = resolveAppRoot();

  private RenderTvLauncherIcon() {}

  public static void main(String[] args) throws Exception {
    renderTo(APP_ROOT + "/design/infini-tv-icon-screen-play.png", 1024);

    renderDensity("mipmap-mdpi", 48);
    renderDensity("mipmap-hdpi", 72);
    renderDensity("mipmap-xhdpi", 96);
    renderDensity("mipmap-xxhdpi", 144);
    renderDensity("mipmap-xxxhdpi", 192);
  }

  private static void renderDensity(String folder, int size) throws Exception {
    String base = APP_ROOT + "/app/src/main/res/" + folder + "/";
    renderTo(base + "ic_launcher.png", size);
    renderTo(base + "ic_launcher_round.png", size);
  }

  private static String resolveAppRoot() {
    File cwd = new File(System.getProperty("user.dir"));
    if ("tools".equals(cwd.getName())) {
      return cwd.getParentFile().getAbsolutePath();
    }
    return cwd.getAbsolutePath();
  }

  private static void renderTo(String path, int size) throws Exception {
    BufferedImage image = new BufferedImage(1024, 1024, BufferedImage.TYPE_INT_ARGB);
    Graphics2D g = image.createGraphics();
    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    drawIcon(g);
    g.dispose();

    BufferedImage output = image;
    if (size != 1024) {
      output = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
      Graphics2D scaled = output.createGraphics();
      scaled.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
      scaled.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
      scaled.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
      scaled.drawImage(image, 0, 0, size, size, null);
      scaled.dispose();
    }

    File file = new File(path);
    File parent = file.getParentFile();
    if (parent != null) {
      parent.mkdirs();
    }
    ImageIO.write(output, "png", file);
  }

  private static void drawIcon(Graphics2D g) {
    Shape clip = new RoundRectangle2D.Double(0, 0, 1024, 1024, 220, 220);
    g.setClip(clip);

    g.setPaint(new GradientPaint(0, 0, new Color(10, 8, 16), 1024, 1024, new Color(35, 10, 52)));
    g.fillRect(0, 0, 1024, 1024);

    g.setComposite(AlphaComposite.SrcOver.derive(0.28f));
    g.setPaint(new GradientPaint(120, 0, new Color(91, 42, 178), 900, 900, new Color(10, 8, 16)));
    GeneralPath slash = new GeneralPath();
    slash.moveTo(720, -80);
    slash.lineTo(1050, -80);
    slash.lineTo(350, 1100);
    slash.lineTo(70, 1100);
    slash.closePath();
    g.fill(slash);
    g.setComposite(AlphaComposite.SrcOver);

    g.setColor(new Color(178, 121, 255, 50));
    g.setStroke(new BasicStroke(10f));
    g.draw(new RoundRectangle2D.Double(64, 64, 896, 896, 190, 190));

    RoundRectangle2D screen = new RoundRectangle2D.Double(188, 236, 648, 420, 82, 82);
    g.setPaint(new GradientPaint(188, 236, new Color(20, 13, 31), 836, 656, new Color(61, 20, 82)));
    g.fill(screen);
    g.setColor(new Color(181, 118, 255));
    g.setStroke(new BasicStroke(18f));
    g.draw(screen);

    g.setPaint(new GradientPaint(242, 294, new Color(32, 20, 45), 782, 598, new Color(10, 8, 16)));
    g.fill(new RoundRectangle2D.Double(242, 294, 540, 304, 52, 52));

    g.setColor(new Color(249, 218, 121));
    g.setStroke(new BasicStroke(22f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
    g.drawLine(348, 704, 676, 704);
    g.drawLine(512, 656, 512, 704);

    g.setStroke(new BasicStroke(18f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
    g.setColor(new Color(92, 49, 149));
    g.draw(new Ellipse2D.Double(390, 324, 244, 244));
    g.setColor(new Color(249, 218, 121));
    g.draw(new Arc2D.Double(390, 324, 244, 244, -35, 118, Arc2D.OPEN));

    g.setColor(new Color(249, 218, 121));
    GeneralPath play = new GeneralPath();
    play.moveTo(488, 386);
    play.lineTo(488, 506);
    play.lineTo(590, 446);
    play.closePath();
    g.fill(play);

    g.setColor(new Color(255, 255, 255, 28));
    g.fill(new Ellipse2D.Double(438, 372, 148, 148));

    drawCenteredText(g, "INFINI", 512, 806, 96, new Color(249, 218, 121));
    drawCenteredText(g, "TV", 512, 902, 112, Color.WHITE);
  }

  private static void drawCenteredText(Graphics2D g, String text, int centerX, int baselineY, int size, Color color) {
    g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, size));
    g.setColor(color);
    FontMetrics metrics = g.getFontMetrics();
    int x = centerX - metrics.stringWidth(text) / 2;
    g.drawString(text, x, baselineY);
  }
}
